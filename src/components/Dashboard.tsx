
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, TrendingUp, Euro, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DashboardStats {
  activeMembers: number;
  totalMinutes: number;
  currentBalance: number;
  plannedBudget: number;
  latestMinuteDate: string | null;
  budgetCompletion: number;
}

interface RecentActivity {
  id: string;
  type: 'member' | 'minute' | 'budget';
  title: string;
  subtitle: string;
  date: string;
  color: string;
}

export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    activeMembers: 0,
    totalMinutes: 0,
    currentBalance: 0,
    plannedBudget: 0,
    latestMinuteDate: null,
    budgetCompletion: 0
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Aggiorna data e ora ogni secondo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchDashboardStats();
    fetchRecentActivities();
  }, []);

  const fetchRecentActivities = async () => {
    try {
      const activities: RecentActivity[] = [];

      // Fetch recent members (last 5)
      const { data: recentMembers } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

      recentMembers?.forEach(member => {
        activities.push({
          id: `member-${member.id}`,
          type: 'member',
          title: 'Nuovo socio iscritto',
          subtitle: `${member.name} ${member.surname}`,
          date: new Date(member.created_at).toLocaleDateString('it-IT'),
          color: 'blue'
        });
      });

      // Fetch recent meeting minutes (last 3)
      const { data: recentMinutes } = await supabase
        .from('meeting_minutes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2);

      recentMinutes?.forEach(minute => {
        activities.push({
          id: `minute-${minute.id}`,
          type: 'minute',
          title: minute.approved ? 'Verbale approvato' : 'Nuovo verbale aggiunto',
          subtitle: minute.title,
          date: new Date(minute.date).toLocaleDateString('it-IT'),
          color: minute.approved ? 'green' : 'orange'
        });
      });

      // Fetch recent budget entries (last 2)
      const { data: recentBudgetEntries } = await supabase
        .from('budget_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(2);

      recentBudgetEntries?.forEach(entry => {
        activities.push({
          id: `budget-${entry.id}`,
          type: 'budget',
          title: entry.type === 'entrata' ? 'Entrata registrata' : 'Uscita registrata',
          subtitle: `€${Number(entry.amount).toFixed(2)} - ${entry.description}`,
          date: new Date(entry.date).toLocaleDateString('it-IT'),
          color: entry.type === 'entrata' ? 'green' : 'red'
        });
      });

      // Sort all activities by date and take the most recent 5
      activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRecentActivities(activities.slice(0, 5));

    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      // Fetch active members
      const { data: members, error: membersError } = await supabase
        .from('members')
        .select('*');
      
      if (membersError) throw membersError;

      const activeMembers = members?.filter(m => m.status === 'attivo').length || 0;

      // Fetch meeting minutes
      const { data: minutes, error: minutesError } = await supabase
        .from('meeting_minutes')
        .select('*')
        .order('date', { ascending: false });
      
      if (minutesError) throw minutesError;

      const currentYear = new Date().getFullYear();
      const currentYearMinutes = minutes?.filter(m => 
        new Date(m.date).getFullYear() === currentYear
      ).length || 0;

      const latestMinute = minutes?.[0];

      // Fetch budget entries
      const { data: budgetEntries, error: budgetError } = await supabase
        .from('budget_entries')
        .select('*');
      
      if (budgetError) throw budgetError;

      const totalIncome = budgetEntries?.filter(e => e.type === 'entrata').reduce((sum, entry) => sum + Number(entry.amount), 0) || 0;
      const totalExpenses = budgetEntries?.filter(e => e.type === 'uscita').reduce((sum, entry) => sum + Number(entry.amount), 0) || 0;
      const currentBalance = totalIncome - totalExpenses;

      // Fetch budget plans for current year
      const { data: budgetPlans, error: plansError } = await supabase
        .from('budget_plans')
        .select('*')
        .eq('year', currentYear);
      
      if (plansError) throw plansError;

      const totalPlanned = budgetPlans?.reduce((sum, plan) => sum + Number(plan.planned_amount), 0) || 0;
      const totalActual = budgetPlans?.reduce((sum, plan) => sum + Number(plan.actual_amount), 0) || 0;
      const budgetCompletion = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : 0;

      setStats({
        activeMembers,
        totalMinutes: currentYearMinutes,
        currentBalance,
        plannedBudget: totalPlanned,
        latestMinuteDate: latestMinute?.date || null,
        budgetCompletion: Math.round(budgetCompletion)
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Caricamento dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Panoramica generale dell'associazione</p>
        </div>
        
        <div className="flex items-center space-x-2 bg-blue-50 px-4 py-2 rounded-lg">
          <Clock className="w-5 h-5 text-blue-600" />
          <div className="text-right">
            <div className="text-sm font-medium text-blue-900">
              {currentDateTime.toLocaleDateString('it-IT')}
            </div>
            <div className="text-xs text-blue-700">
              {currentDateTime.toLocaleTimeString('it-IT')}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Soci Attivi</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeMembers}</div>
            <p className="text-xs text-muted-foreground">Soci con status attivo</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verbali {new Date().getFullYear()}</CardTitle>
            <FileText className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMinutes}</div>
            <p className="text-xs text-muted-foreground">
              {stats.latestMinuteDate ? `Ultimo: ${new Date(stats.latestMinuteDate).toLocaleDateString('it-IT')}` : 'Nessun verbale'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bilancio Attuale</CardTitle>
            <Euro className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{stats.currentBalance.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">Entrate - Uscite</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Preventivo {new Date().getFullYear()}</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stats.plannedBudget.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{stats.budgetCompletion}% completato</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Attività Recenti</CardTitle>
            <CardDescription>Ultime operazioni nell'associazione</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center">
                    <div className={`w-2 h-2 rounded-full mr-3 bg-${activity.color}-500`}></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-gray-500">{activity.subtitle} - {activity.date}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-gray-500">
                  Nessuna attività recente
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prossime Scadenze</CardTitle>
            <CardDescription>Eventi e scadenze importanti</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Controllo scadenza quote annuali */}
              {(() => {
                const now = new Date();
                const endOfYear = new Date(now.getFullYear(), 11, 31); // 31 dicembre
                const daysToEndOfYear = Math.ceil((endOfYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysToEndOfYear <= 60) {
                  return (
                    <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Scadenza Quote {now.getFullYear()}</p>
                        <p className="text-xs text-gray-500">31 Dicembre {now.getFullYear()}</p>
                      </div>
                      <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                        {daysToEndOfYear} giorni
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
              
              {/* Controllo assemblea ordinaria */}
              {(() => {
                const now = new Date();
                const assemblyDate = new Date(now.getFullYear(), 2, 31); // 31 marzo
                if (assemblyDate < now) {
                  assemblyDate.setFullYear(now.getFullYear() + 1);
                }
                const daysToAssembly = Math.ceil((assemblyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysToAssembly <= 90) {
                  return (
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">Assemblea Ordinaria</p>
                        <p className="text-xs text-gray-500">31 Marzo {assemblyDate.getFullYear()}</p>
                      </div>
                      <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                        {daysToAssembly} giorni
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
              
              {/* Se non ci sono scadenze imminenti */}
              {(() => {
                const now = new Date();
                const endOfYear = new Date(now.getFullYear(), 11, 31);
                const assemblyDate = new Date(now.getFullYear(), 2, 31);
                if (assemblyDate < now) {
                  assemblyDate.setFullYear(now.getFullYear() + 1);
                }
                const daysToEndOfYear = Math.ceil((endOfYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                const daysToAssembly = Math.ceil((assemblyDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                
                if (daysToEndOfYear > 60 && daysToAssembly > 90) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      Nessuna scadenza imminente
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
