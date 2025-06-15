import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePrint } from "@/hooks/usePrint";
import { supabase } from "@/integrations/supabase/client";

interface MeetingMinute {
  id: string;
  title: string;
  date: string;
  type: "assemblea" | "consiglio" | "commissione";
  participants: number;
  content: string;
  approved: boolean;
}

export const MeetingMinutes = () => {
  const { toast } = useToast();
  const { printContent } = usePrint();
  
  const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [editingMinute, setEditingMinute] = useState<MeetingMinute | null>(null);
  const [viewingMinute, setViewingMinute] = useState<MeetingMinute | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    date: "",
    type: "assemblea" as "assemblea" | "consiglio" | "commissione",
    participants: 0,
    content: "",
    approved: false
  });

  useEffect(() => {
    fetchMinutes();
  }, []);

  const fetchMinutes = async () => {
    try {
      const { data, error } = await supabase
        .from('meeting_minutes')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      // Type assertion to ensure proper typing
      const typedMinutes = (data || []).map(minute => ({
        ...minute,
        type: minute.type as "assemblea" | "consiglio" | "commissione"
      }));
      
      setMinutes(typedMinutes);
      
      // Extract available years from the data
      const years = [...new Set(typedMinutes.map(minute => 
        new Date(minute.date).getFullYear()
      ))].sort((a, b) => b - a);
      
      setAvailableYears(years);
      
      // If current year is not in the list and there are years available, set the first available year
      if (years.length > 0 && !years.includes(selectedYear)) {
        setSelectedYear(years[0]);
      }
    } catch (error) {
      console.error('Error fetching meeting minutes:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i verbali.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter minutes by selected year and search term
  const filteredMinutes = minutes.filter(minute => {
    const minuteYear = new Date(minute.date).getFullYear();
    const matchesYear = minuteYear === selectedYear;
    const matchesSearch = minute.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         minute.type.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesYear && matchesSearch;
  });

  const handleYearChange = (direction: 'prev' | 'next') => {
    const currentIndex = availableYears.indexOf(selectedYear);
    if (direction === 'prev' && currentIndex < availableYears.length - 1) {
      setSelectedYear(availableYears[currentIndex + 1]);
    } else if (direction === 'next' && currentIndex > 0) {
      setSelectedYear(availableYears[currentIndex - 1]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingMinute) {
        const { error } = await supabase
          .from('meeting_minutes')
          .update(formData)
          .eq('id', editingMinute.id);
        
        if (error) throw error;
        
        toast({
          title: "Verbale aggiornato",
          description: "Le modifiche sono state salvate con successo.",
        });
      } else {
        const { error } = await supabase
          .from('meeting_minutes')
          .insert([formData]);
        
        if (error) throw error;
        
        toast({
          title: "Nuovo verbale aggiunto",
          description: "Il verbale è stato registrato con successo.",
        });
      }

      setIsDialogOpen(false);
      setEditingMinute(null);
      setFormData({
        title: "",
        date: "",
        type: "assemblea",
        participants: 0,
        content: "",
        approved: false
      });
      fetchMinutes();
    } catch (error) {
      console.error('Error saving meeting minute:', error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il verbale.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (minute: MeetingMinute) => {
    setEditingMinute(minute);
    setFormData({
      title: minute.title,
      date: minute.date,
      type: minute.type,
      participants: minute.participants,
      content: minute.content,
      approved: minute.approved
    });
    setIsDialogOpen(true);
  };

  const handleView = (minute: MeetingMinute) => {
    setViewingMinute(minute);
    setIsViewDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('meeting_minutes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Verbale rimosso",
        description: "Il verbale è stato rimosso dal libro verbali.",
        variant: "destructive",
      });
      fetchMinutes();
    } catch (error) {
      console.error('Error deleting meeting minute:', error);
      toast({
        title: "Errore",
        description: "Impossibile rimuovere il verbale.",
        variant: "destructive",
      });
    }
  };

  const getTypeBadge = (type: string) => {
    const variants = {
      assemblea: "bg-blue-100 text-blue-800",
      consiglio: "bg-green-100 text-green-800",
      commissione: "bg-purple-100 text-purple-800"
    };
    
    return (
      <Badge className={variants[type as keyof typeof variants]}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const handlePrint = () => {
    const yearMinutes = filteredMinutes;
    const assembleaCount = yearMinutes.filter(m => m.type === "assemblea").length;
    const consiglioCount = yearMinutes.filter(m => m.type === "consiglio").length;
    const commissioneCount = yearMinutes.filter(m => m.type === "commissione").length;
    const approvedCount = yearMinutes.filter(m => m.approved).length;
    
    const tableRows = yearMinutes.map(minute => `
      <tr>
        <td>${minute.title}</td>
        <td class="text-center">${new Date(minute.date).toLocaleDateString('it-IT')}</td>
        <td class="text-center">
          <span class="badge ${
            minute.type === 'assemblea' ? 'badge-info' : 
            minute.type === 'consiglio' ? 'badge-success' : 'badge-warning'
          }">
            ${minute.type.charAt(0).toUpperCase() + minute.type.slice(1)}
          </span>
        </td>
        <td class="text-center">${minute.participants}</td>
        <td class="text-center">
          <span class="badge ${minute.approved ? 'badge-success' : 'badge-danger'}">
            ${minute.approved ? 'Approvato' : 'In Attesa'}
          </span>
        </td>
        <td style="font-size: 10px;">${minute.content.substring(0, 100)}${minute.content.length > 100 ? '...' : ''}</td>
      </tr>
    `).join('');

    const detailedMinutes = yearMinutes.map(minute => `
      <div class="page-break">
        <h3 style="border-bottom: 1px solid #000; padding-bottom: 10px;">${minute.title}</h3>
        <div style="margin: 20px 0;">
          <p><strong>Data:</strong> ${new Date(minute.date).toLocaleDateString('it-IT')}</p>
          <p><strong>Tipo:</strong> ${minute.type.charAt(0).toUpperCase() + minute.type.slice(1)}</p>
          <p><strong>Partecipanti:</strong> ${minute.participants}</p>
          <p><strong>Stato:</strong> ${minute.approved ? 'Approvato' : 'In Attesa di Approvazione'}</p>
        </div>
        <h4>Contenuto del Verbale:</h4>
        <div style="text-align: justify; line-height: 1.6; padding: 15px; border: 1px solid #ddd; background-color: #fafafa;">
          ${minute.content.split('\n').map(paragraph => `<p>${paragraph}</p>`).join('')}
        </div>
      </div>
    `).join('');

    const printHTML = `
      <div class="summary">
        <h3>Riepilogo Libro Verbali - Anno ${selectedYear}</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
          <div>
            <p><strong>Totale Verbali ${selectedYear}:</strong> ${yearMinutes.length}</p>
            <p><strong>Assemblee:</strong> ${assembleaCount}</p>
            <p><strong>Consigli:</strong> ${consiglioCount}</p>
            <p><strong>Commissioni:</strong> ${commissioneCount}</p>
          </div>
          <div>
            <p><strong>Verbali Approvati:</strong> ${approvedCount}</p>
            <p><strong>In Attesa:</strong> ${yearMinutes.length - approvedCount}</p>
            <p><strong>Percentuale Approvazione:</strong> ${yearMinutes.length > 0 ? ((approvedCount / yearMinutes.length) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>
      </div>
      
      <h3>Elenco Verbali ${selectedYear}</h3>
      <table>
        <thead>
          <tr>
            <th>Titolo</th>
            <th>Data</th>
            <th>Tipo</th>
            <th>Partecipanti</th>
            <th>Stato</th>
            <th>Contenuto (anteprima)</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      
      ${detailedMinutes}
    `;

    printContent(printHTML, `Libro Verbali ${selectedYear}`);
    
    toast({
      title: "Stampa avviata",
      description: `Il documento dei verbali ${selectedYear} è stato inviato alla stampante.`,
    });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Libro Verbali</h1>
          <p className="text-gray-600 mt-2">Gestione dei verbali di riunioni e assemblee</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Stampa
          </Button>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingMinute(null);
                setFormData({
                  title: "",
                  date: "",
                  type: "assemblea",
                  participants: 0,
                  content: "",
                  approved: false
                });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Verbale
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingMinute ? "Modifica Verbale" : "Nuovo Verbale"}
                </DialogTitle>
                <DialogDescription>
                  {editingMinute ? "Modifica i dati del verbale" : "Aggiungi un nuovo verbale al libro"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="title">Titolo</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date">Data</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="participants">Partecipanti</Label>
                    <Input
                      id="participants"
                      type="number"
                      value={formData.participants}
                      onChange={(e) => setFormData({...formData, participants: parseInt(e.target.value) || 0})}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="type">Tipo</Label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="assemblea">Assemblea</option>
                    <option value="consiglio">Consiglio</option>
                    <option value="commissione">Commissione</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="content">Contenuto</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({...formData, content: e.target.value})}
                    rows={6}
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="approved"
                    type="checkbox"
                    checked={formData.approved}
                    onChange={(e) => setFormData({...formData, approved: e.target.checked})}
                  />
                  <Label htmlFor="approved">Verbale approvato</Label>
                </div>
                <Button type="submit" className="w-full">
                  {editingMinute ? "Aggiorna" : "Aggiungi"} Verbale
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Year Selection */}
      <div className="flex items-center justify-center space-x-4 bg-gray-50 p-4 rounded-lg">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleYearChange('prev')}
          disabled={availableYears.indexOf(selectedYear) === availableYears.length - 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">Anno {selectedYear}</h2>
          <p className="text-sm text-gray-600">
            {filteredMinutes.length} verbale{filteredMinutes.length !== 1 ? 'i' : ''} registrato{filteredMinutes.length !== 1 ? 'i' : ''}
          </p>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleYearChange('next')}
          disabled={availableYears.indexOf(selectedYear) === 0}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Verbali {selectedYear}</CardTitle>
          <CardDescription>
            {filteredMinutes.length} verbali per l'anno {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cerca verbali per titolo o tipo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Titolo</th>
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Tipo</th>
                  <th className="text-left p-2">Partecipanti</th>
                  <th className="text-left p-2">Stato</th>
                  <th className="text-left p-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredMinutes.map((minute) => (
                  <tr key={minute.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{minute.title}</td>
                    <td className="p-2 text-gray-600">
                      {new Date(minute.date).toLocaleDateString('it-IT')}
                    </td>
                    <td className="p-2">{getTypeBadge(minute.type)}</td>
                    <td className="p-2 text-gray-600">{minute.participants}</td>
                    <td className="p-2">
                      <Badge variant={minute.approved ? "default" : "destructive"}>
                        {minute.approved ? "Approvato" : "In Attesa"}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleView(minute)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(minute)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(minute.id)}
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

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewingMinute?.title}</DialogTitle>
            <DialogDescription>
              {viewingMinute?.date && new Date(viewingMinute.date).toLocaleDateString('it-IT')} - 
              {' '}{viewingMinute?.participants} partecipanti
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              {viewingMinute && getTypeBadge(viewingMinute.type)}
              <Badge variant={viewingMinute?.approved ? "default" : "destructive"}>
                {viewingMinute?.approved ? "Approvato" : "In Attesa"}
              </Badge>
            </div>
            <div>
              <h4 className="font-medium mb-2">Contenuto</h4>
              <p className="text-gray-700 whitespace-pre-wrap">{viewingMinute?.content}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
