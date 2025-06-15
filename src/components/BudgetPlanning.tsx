import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Edit, Trash2, Target, TrendingUp, TrendingDown, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePrint } from "@/hooks/usePrint";
import { supabase } from "@/integrations/supabase/client";

interface BudgetPlan {
  id: string;
  category: string;
  planned_amount: number;
  actual_amount: number;
  year: number;
  type: "entrata" | "uscita";
}

export const BudgetPlanning = () => {
  const { toast } = useToast();
  const { printContent } = usePrint();
  
  const [plans, setPlans] = useState<BudgetPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BudgetPlan | null>(null);
  const [formData, setFormData] = useState({
    category: "",
    planned_amount: 0,
    actual_amount: 0,
    year: new Date().getFullYear(),
    type: "entrata" as "entrata" | "uscita"
  });
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchPlans();
  }, [selectedYear]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('budget_plans')
        .select('*')
        .eq('year', selectedYear)
        .order('category', { ascending: true });
      
      if (error) throw error;
      
      // Type assertion to ensure proper typing
      const typedPlans = (data || []).map(plan => ({
        ...plan,
        type: plan.type as "entrata" | "uscita"
      }));
      
      setPlans(typedPlans);
    } catch (error) {
      console.error('Error fetching budget plans:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i piani di bilancio.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortedPlans = (plans: BudgetPlan[]) => {
    if (!sortField) return plans;

    return [...plans].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "category":
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case "planned_amount":
          aValue = a.planned_amount;
          bValue = b.planned_amount;
          break;
        case "actual_amount":
          aValue = a.actual_amount;
          bValue = b.actual_amount;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  };

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return sortDirection === "asc" ? <span className="text-blue-600 ml-1">↑</span> : <span className="text-blue-600 ml-1">↓</span>;
  };

  const filteredPlans = plans.filter(plan => plan.year === selectedYear);

  const totalPlannedIncome = plans.filter(p => p.type === "entrata").reduce((sum, plan) => sum + plan.planned_amount, 0);
  const totalPlannedExpenses = plans.filter(p => p.type === "uscita").reduce((sum, plan) => sum + plan.planned_amount, 0);
  const totalActualIncome = plans.filter(p => p.type === "entrata").reduce((sum, plan) => sum + plan.actual_amount, 0);
  const totalActualExpenses = plans.filter(p => p.type === "uscita").reduce((sum, plan) => sum + plan.actual_amount, 0);

  const plannedBalance = totalPlannedIncome - totalPlannedExpenses;
  const actualBalance = totalActualIncome - totalActualExpenses;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingPlan) {
        const { error } = await supabase
          .from('budget_plans')
          .update(formData)
          .eq('id', editingPlan.id);
        
        if (error) throw error;
        
        toast({
          title: "Piano aggiornato",
          description: "Le modifiche sono state salvate con successo.",
        });
      } else {
        const { error } = await supabase
          .from('budget_plans')
          .insert([formData]);
        
        if (error) throw error;
        
        toast({
          title: "Nuovo piano aggiunto",
          description: "Il piano è stato registrato con successo.",
        });
      }

      setIsDialogOpen(false);
      setEditingPlan(null);
      setFormData({
        category: "",
        planned_amount: 0,
        actual_amount: 0,
        year: selectedYear,
        type: "entrata"
      });
      fetchPlans();
    } catch (error) {
      console.error('Error saving budget plan:', error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il piano.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (plan: BudgetPlan) => {
    setEditingPlan(plan);
    setFormData({
      category: plan.category,
      planned_amount: plan.planned_amount,
      actual_amount: plan.actual_amount,
      year: plan.year,
      type: plan.type
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('budget_plans')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Piano rimosso",
        description: "Il piano è stato rimosso dal bilancio preventivo.",
        variant: "destructive",
      });
      fetchPlans();
    } catch (error) {
      console.error('Error deleting budget plan:', error);
      toast({
        title: "Errore",
        description: "Impossibile rimuovere il piano.",
        variant: "destructive",
      });
    }
  };

  const getProgressPercentage = (actual: number, planned: number) => {
    return planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
  };

  const handlePrint = () => {
    const entrateRows = plans.filter(p => p.type === "entrata").map(plan => `
      <tr>
        <td>${plan.category}</td>
        <td class="text-right">€${plan.planned_amount.toFixed(2)}</td>
        <td class="text-right">€${plan.actual_amount.toFixed(2)}</td>
        <td class="text-right ${plan.actual_amount - plan.planned_amount >= 0 ? 'text-green' : 'text-red'}">
          €${(plan.actual_amount - plan.planned_amount).toFixed(2)}
        </td>
        <td class="text-right">
          ${plan.planned_amount > 0 ? ((plan.actual_amount / plan.planned_amount) * 100).toFixed(1) : 0}%
        </td>
      </tr>
    `).join('');

    const usciteRows = plans.filter(p => p.type === "uscita").map(plan => `
      <tr>
        <td>${plan.category}</td>
        <td class="text-right">€${plan.planned_amount.toFixed(2)}</td>
        <td class="text-right">€${plan.actual_amount.toFixed(2)}</td>
        <td class="text-right ${plan.actual_amount - plan.planned_amount <= 0 ? 'text-green' : 'text-red'}">
          €${(plan.actual_amount - plan.planned_amount).toFixed(2)}
        </td>
        <td class="text-right">
          ${plan.planned_amount > 0 ? ((plan.actual_amount / plan.planned_amount) * 100).toFixed(1) : 0}%
        </td>
      </tr>
    `).join('');

    const printHTML = `
      <div class="summary">
        <h3>Riepilogo Bilancio Preventivo ${selectedYear}</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px;">
          <div>
            <h4 style="color: #28a745; margin-bottom: 15px;">ENTRATE</h4>
            <p><strong>Previste:</strong> €${totalPlannedIncome.toFixed(2)}</p>
            <p><strong>Effettive:</strong> €${totalActualIncome.toFixed(2)}</p>
            <p><strong>Differenza:</strong> <span style="color: ${totalActualIncome - totalPlannedIncome >= 0 ? '#28a745' : '#dc3545'}">€${(totalActualIncome - totalPlannedIncome).toFixed(2)}</span></p>
          </div>
          <div>
            <h4 style="color: #dc3545; margin-bottom: 15px;">USCITE</h4>
            <p><strong>Previste:</strong> €${totalPlannedExpenses.toFixed(2)}</p>
            <p><strong>Effettive:</strong> €${totalActualExpenses.toFixed(2)}</p>
            <p><strong>Differenza:</strong> <span style="color: ${totalActualExpenses - totalPlannedExpenses <= 0 ? '#28a745' : '#dc3545'}">€${(totalActualExpenses - totalPlannedExpenses).toFixed(2)}</span></p>
          </div>
        </div>
        <div style="margin-top: 20px; padding: 15px; border: 2px solid ${actualBalance >= 0 ? '#28a745' : '#dc3545'}; background-color: ${actualBalance >= 0 ? '#f8fff9' : '#fff8f8'}; text-align: center;">
          <h4 style="color: ${actualBalance >= 0 ? '#28a745' : '#dc3545'}; margin: 0;">SALDO ATTUALE: €${actualBalance.toFixed(2)}</h4>
          <p style="margin: 5px 0;">Saldo Previsto: €${plannedBalance.toFixed(2)}</p>
          <p style="margin: 5px 0;">Differenza: <span style="color: ${actualBalance - plannedBalance >= 0 ? '#28a745' : '#dc3545'};">€${(actualBalance - plannedBalance).toFixed(2)}</span></p>
        </div>
      </div>
      
      <h3>ENTRATE</h3>
      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Previsto</th>
            <th>Effettivo</th>
            <th>Differenza</th>
            <th>% Realizzazione</th>
          </tr>
        </thead>
        <tbody>
          ${entrateRows}
        </tbody>
      </table>
      
      <h3>USCITE</h3>
      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Previsto</th>
            <th>Effettivo</th>
            <th>Differenza</th>
            <th>% Realizzazione</th>
          </tr>
        </thead>
        <tbody>
          ${usciteRows}
        </tbody>
      </table>
    `;

    printContent(printHTML, `Bilancio Preventivo ${selectedYear}`);
    
    toast({
      title: "Stampa avviata",
      description: "Il documento è stato inviato alla stampante.",
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bilancio Preventivo</h1>
          <p className="text-gray-600 mt-2">Pianificazione e monitoraggio del budget</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="p-2 border border-gray-300 rounded-md"
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Stampa
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingPlan(null);
                setFormData({
                  category: "",
                  planned_amount: 0,
                  actual_amount: 0,
                  year: selectedYear,
                  type: "entrata"
                });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Piano
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingPlan ? "Modifica Piano" : "Nuovo Piano"}
                </DialogTitle>
                <DialogDescription>
                  {editingPlan ? "Modifica i dati del piano" : "Aggiungi un nuovo piano al bilancio preventivo"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Tipo</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="entrata">Entrata</option>
                    <option value="uscita">Uscita</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="planned_amount">Importo Previsto (€)</Label>
                    <Input
                      id="planned_amount"
                      type="number"
                      step="0.01"
                      value={formData.planned_amount}
                      onChange={(e) => setFormData({...formData, planned_amount: parseFloat(e.target.value) || 0})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="actual_amount">Importo Effettivo (€)</Label>
                    <Input
                      id="actual_amount"
                      type="number"
                      step="0.01"
                      value={formData.actual_amount}
                      onChange={(e) => setFormData({...formData, actual_amount: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="year">Anno</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: parseInt(e.target.value) || new Date().getFullYear()})}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  {editingPlan ? "Aggiorna" : "Aggiungi"} Piano
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entrate Previste</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              €{totalPlannedIncome.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entrate Effettive</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              €{totalActualIncome.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uscite Previste</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              €{totalPlannedExpenses.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Attuale</CardTitle>
            <TrendingUp className={`h-4 w-4 ${actualBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${actualBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{actualBalance.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Entrate {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th 
                      className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                      onClick={() => handleSort("category")}
                    >
                      <div className="flex items-center">
                        Categoria
                        {getSortIcon("category")}
                      </div>
                    </th>
                    <th 
                      className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                      onClick={() => handleSort("planned_amount")}
                    >
                      <div className="flex items-center">
                        Previsto
                        {getSortIcon("planned_amount")}
                      </div>
                    </th>
                    <th 
                      className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                      onClick={() => handleSort("actual_amount")}
                    >
                      <div className="flex items-center">
                        Effettivo
                        {getSortIcon("actual_amount")}
                      </div>
                    </th>
                    <th className="text-left p-2">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedPlans(filteredPlans.filter(plan => plan.type === "entrata")).map((plan) => (
                    <tr key={plan.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{plan.category}</td>
                      <td className="p-2 text-green-600">€{plan.planned_amount.toFixed(2)}</td>
                      <td className="p-2 text-blue-600">€{plan.actual_amount.toFixed(2)}</td>
                      <td className="p-2">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(plan)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(plan.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Uscite {selectedYear}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th 
                      className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                      onClick={() => handleSort("category")}
                    >
                      <div className="flex items-center">
                        Categoria
                        {getSortIcon("category")}
                      </div>
                    </th>
                    <th 
                      className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                      onClick={() => handleSort("planned_amount")}
                    >
                      <div className="flex items-center">
                        Previsto
                        {getSortIcon("planned_amount")}
                      </div>
                    </th>
                    <th 
                      className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                      onClick={() => handleSort("actual_amount")}
                    >
                      <div className="flex items-center">
                        Effettivo
                        {getSortIcon("actual_amount")}
                      </div>
                    </th>
                    <th className="text-left p-2">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedPlans(filteredPlans.filter(plan => plan.type === "uscita")).map((plan) => (
                    <tr key={plan.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{plan.category}</td>
                      <td className="p-2 text-red-600">€{plan.planned_amount.toFixed(2)}</td>
                      <td className="p-2 text-blue-600">€{plan.actual_amount.toFixed(2)}</td>
                      <td className="p-2">
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(plan)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(plan.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
