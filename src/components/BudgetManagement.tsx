import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, TrendingUp, TrendingDown, Printer, Clock, Upload, FileSpreadsheet, Download, Wallet, CreditCard, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePrint } from "@/hooks/usePrint";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

interface BudgetEntry {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  type: "entrata" | "uscita";
  portafoglio: "contante" | "conto";
}

export const BudgetManagement = () => {
  const { toast } = useToast();
  const { printContent } = usePrint();
  
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("tutti");
  const [portafoglioFilter, setPortafoglioFilter] = useState("tutti");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<BudgetEntry | null>(null);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [formData, setFormData] = useState({
    description: "",
    amount: 0,
    date: "",
    category: "",
    type: "entrata" as "entrata" | "uscita",
    portafoglio: "contante" as "contante" | "conto"
  });
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Aggiorna data e ora ogni secondo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('budget_entries')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      // Type assertion to ensure proper typing
      const typedEntries = (data || []).map(entry => ({
        ...entry,
        type: entry.type as "entrata" | "uscita",
        portafoglio: entry.portafoglio as "contante" | "conto"
      }));
      
      setEntries(typedEntries);
      
      // Calcola gli anni disponibili
      const years = [...new Set(typedEntries.map(entry => new Date(entry.date).getFullYear()))].sort((a, b) => b - a);
      setAvailableYears(years);
    } catch (error) {
      console.error('Error fetching budget entries:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i movimenti di bilancio.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const parseAmount = (amountStr: any): number => {
    if (typeof amountStr === 'number') {
      return Math.abs(amountStr); // Prendi sempre il valore assoluto
    }
    
    if (!amountStr) return 0;
    
    // Converte in stringa e rimuove spazi
    let cleanAmount = amountStr.toString().trim();
    
    // Rimuove simboli di valuta comuni
    cleanAmount = cleanAmount.replace(/[€$£¥₹]/g, '');
    
    // Rimuove spazi e altri caratteri non numerici eccetto , . e -
    cleanAmount = cleanAmount.replace(/[^\d,.-]/g, '');
    
    // Gestisce il formato europeo (1.234,56) vs americano (1,234.56)
    if (cleanAmount.includes(',') && cleanAmount.includes('.')) {
      // Se ci sono entrambi, l'ultimo è il separatore decimale
      const lastComma = cleanAmount.lastIndexOf(',');
      const lastDot = cleanAmount.lastIndexOf('.');
      
      if (lastComma > lastDot) {
        // Formato europeo: 1.234,56
        cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato americano: 1,234.56
        cleanAmount = cleanAmount.replace(/,/g, '');
      }
    } else if (cleanAmount.includes(',')) {
      // Solo virgola - potrebbe essere separatore decimale o migliaia
      const parts = cleanAmount.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Probabilmente separatore decimale
        cleanAmount = cleanAmount.replace(',', '.');
      } else {
        // Probabilmente separatore migliaia
        cleanAmount = cleanAmount.replace(/,/g, '');
      }
    }
    
    const parsed = parseFloat(cleanAmount);
    return isNaN(parsed) ? 0 : Math.abs(parsed); // Prendi sempre il valore assoluto
  };

  const parseDate = (dateValue: any): string => {
    if (!dateValue) return '';
    
    // Se è un numero (formato Excel)
    if (typeof dateValue === 'number') {
      const excelDate = new Date((dateValue - 25569) * 86400 * 1000);
      return excelDate.toISOString().split('T')[0];
    }
    
    // Se è una stringa
    const dateStr = dateValue.toString().trim();
    
    // Prova diversi formati
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        let day, month, year;
        
        // Determina il formato basandosi sulla lunghezza dell'anno
        if (parts[2].length === 4) {
          // DD/MM/YYYY o MM/DD/YYYY
          if (parseInt(parts[0]) > 12) {
            // Primo numero > 12, deve essere giorno
            day = parts[0].padStart(2, '0');
            month = parts[1].padStart(2, '0');
          } else if (parseInt(parts[1]) > 12) {
            // Secondo numero > 12, deve essere giorno
            month = parts[0].padStart(2, '0');
            day = parts[1].padStart(2, '0');
          } else {
            // Assumo formato europeo DD/MM/YYYY
            day = parts[0].padStart(2, '0');
            month = parts[1].padStart(2, '0');
          }
          year = parts[2];
        } else if (parts[0].length === 4) {
          // YYYY/MM/DD
          year = parts[0];
          month = parts[1].padStart(2, '0');
          day = parts[2].padStart(2, '0');
        }
        
        if (day && month && year) {
          return `${year}-${month}-${day}`;
        }
      }
    } else if (dateStr.includes('-')) {
      // Assume formato ISO o simile
      return dateStr;
    }
    
    return '';
  };

  const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Starting Excel import, file:', file.name);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      console.log('Excel data parsed:', jsonData);

      if (jsonData.length < 2) {
        toast({
          title: "Errore",
          description: "Il file Excel deve contenere almeno una riga di intestazione e una di dati.",
          variant: "destructive",
        });
        return;
      }

      const headers = jsonData[0] as string[];
      const rows = jsonData.slice(1) as any[][];

      console.log('Headers found:', headers);
      console.log('Data rows:', rows.length);

      let importedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        if (!row || row.every(cell => !cell)) {
          continue;
        }

        try {
          const findColumnIndex = (names: string[]) => {
            for (const name of names) {
              const index = headers.findIndex(h => 
                h && h.toString().toLowerCase().includes(name.toLowerCase())
              );
              if (index !== -1) return index;
            }
            return -1;
          };

          const descIndex = findColumnIndex(['descrizione', 'description', 'desc']);
          const amountIndex = findColumnIndex(['importo', 'amount', 'valore']);
          const dateIndex = findColumnIndex(['data', 'date']);
          const categoryIndex = findColumnIndex(['categoria', 'category', 'cat']);
          const typeIndex = findColumnIndex(['tipo', 'type']);
          const portafoglioIndex = findColumnIndex(['portafoglio', 'wallet', 'conto']);

          const rawData = {
            description: row[descIndex !== -1 ? descIndex : 0] || '',
            amount: row[amountIndex !== -1 ? amountIndex : 1] || 0,
            date: row[dateIndex !== -1 ? dateIndex : 2] || '',
            category: row[categoryIndex !== -1 ? categoryIndex : 3] || '',
            type: row[typeIndex !== -1 ? typeIndex : 4] || 'entrata',
            portafoglio: row[portafoglioIndex !== -1 ? portafoglioIndex : 5] || 'contante'
          };

          console.log(`Row ${i + 1} raw data:`, rawData);

          // Valida descrizione
          if (!rawData.description || rawData.description.toString().trim() === '') {
            errors.push(`Riga ${i + 2}: Descrizione mancante`);
            errorCount++;
            continue;
          }

          // Parse e valida importo
          const amountValue = parseAmount(rawData.amount);
          console.log(`Row ${i + 1} parsed amount:`, amountValue, 'from:', rawData.amount);
          
          if (amountValue === 0) {
            errors.push(`Riga ${i + 2}: Importo non valido (${rawData.amount})`);
            errorCount++;
            continue;
          }

          // Parse e valida data
          const dateValue = parseDate(rawData.date);
          console.log(`Row ${i + 1} parsed date:`, dateValue, 'from:', rawData.date);
          
          if (!dateValue) {
            errors.push(`Riga ${i + 2}: Data non valida (${rawData.date})`);
            errorCount++;
            continue;
          }

          // Valida categoria
          if (!rawData.category || rawData.category.toString().trim() === '') {
            errors.push(`Riga ${i + 2}: Categoria mancante`);
            errorCount++;
            continue;
          }

          // Valida e normalizza tipo
          const typeValue = rawData.type.toString().toLowerCase().trim();
          let finalType: 'entrata' | 'uscita';
          
          if (['entrata', 'entrate', 'income', 'in', '+'].includes(typeValue)) {
            finalType = 'entrata';
          } else if (['uscita', 'uscite', 'expense', 'out', '-'].includes(typeValue)) {
            finalType = 'uscita';
          } else {
            errors.push(`Riga ${i + 2}: Tipo non valido (${rawData.type}). Usa 'entrata' o 'uscita'`);
            errorCount++;
            continue;
          }

          // Valida e normalizza portafoglio
          const portafoglioValue = rawData.portafoglio.toString().toLowerCase().trim();
          let finalPortafoglio: 'contante' | 'conto';
          
          if (['contante', 'contanti', 'cash', 'cassa'].includes(portafoglioValue)) {
            finalPortafoglio = 'contante';
          } else if (['conto', 'banca', 'bank', 'account'].includes(portafoglioValue)) {
            finalPortafoglio = 'conto';
          } else {
            errors.push(`Riga ${i + 2}: Portafoglio non valido (${rawData.portafoglio}). Usa 'contante' o 'conto'`);
            errorCount++;
            continue;
          }

          const finalData = {
            description: rawData.description.toString().trim(),
            amount: amountValue,
            date: dateValue,
            category: rawData.category.toString().trim(),
            type: finalType,
            portafoglio: finalPortafoglio
          };

          console.log(`Inserting row ${i + 1}:`, finalData);

          const { error } = await supabase
            .from('budget_entries')
            .insert([finalData]);

          if (error) {
            console.error('Supabase error for row', i + 1, ':', error);
            errors.push(`Riga ${i + 2}: Errore database - ${error.message}`);
            errorCount++;
          } else {
            importedCount++;
          }
        } catch (error) {
          console.error('Error processing row', i + 1, ':', error);
          errors.push(`Riga ${i + 2}: Errore di elaborazione - ${error}`);
          errorCount++;
        }
      }

      console.log('Import completed:', { importedCount, errorCount, errors });

      const message = `${importedCount} movimenti importati con successo.${errorCount > 0 ? ` ${errorCount} errori.` : ''}`;
      
      if (errors.length > 0 && errors.length <= 10) {
        console.log('First 10 errors:', errors.slice(0, 10));
      }

      toast({
        title: "Import completato",
        description: message,
        variant: errorCount > importedCount ? "destructive" : "default",
      });

      if (importedCount > 0) {
        fetchEntries();
      }
      setIsImportDialogOpen(false);
      
      event.target.value = '';
    } catch (error) {
      console.error('Excel import error:', error);
      toast({
        title: "Errore import",
        description: `Errore durante l'importazione: ${error}`,
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = () => {
    try {
      // Prepara i dati per l'export
      const exportData = sortedAndFilteredEntries.map(entry => ({
        Data: new Date(entry.date).toLocaleDateString('it-IT'),
        Descrizione: entry.description,
        Categoria: entry.category,
        Tipo: entry.type === 'entrata' ? 'Entrata' : 'Uscita',
        Portafoglio: entry.portafoglio === 'contante' ? 'Contante' : 'Conto',
        Importo: entry.amount
      }));

      // Crea un nuovo workbook
      const wb = XLSX.utils.book_new();
      
      // Crea il worksheet con i dati
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Imposta la larghezza delle colonne
      const colWidths = [
        { wch: 12 }, // Data
        { wch: 30 }, // Descrizione
        { wch: 20 }, // Categoria
        { wch: 10 }, // Tipo
        { wch: 12 }, // Portafoglio
        { wch: 15 }  // Importo
      ];
      ws['!cols'] = colWidths;

      // Aggiungi il worksheet al workbook
      XLSX.utils.book_append_sheet(wb, ws, `Bilancio ${selectedYear}`);

      // Crea il nome del file
      const fileName = `Bilancio_${selectedYear}_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Salva il file
      XLSX.writeFile(wb, fileName);

      toast({
        title: "Export completato",
        description: `File Excel salvato: ${fileName}`,
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Errore export",
        description: "Impossibile esportare i dati in Excel.",
        variant: "destructive",
      });
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

  const getSortedEntries = (entries: BudgetEntry[]) => {
    if (!sortField) return entries;

    return [...entries].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "date":
          aValue = new Date(a.date);
          bValue = new Date(b.date);
          break;
        case "description":
          aValue = a.description.toLowerCase();
          bValue = b.description.toLowerCase();
          break;
        case "category":
          aValue = a.category.toLowerCase();
          bValue = b.category.toLowerCase();
          break;
        case "type":
          aValue = a.type;
          bValue = b.type;
          break;
        case "portafoglio":
          aValue = a.portafoglio;
          bValue = b.portafoglio;
          break;
        case "amount":
          aValue = a.amount;
          bValue = b.amount;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  };

  const yearFilteredEntries = entries.filter(entry => 
    new Date(entry.date).getFullYear() === selectedYear
  );

  const filteredEntries = yearFilteredEntries.filter(entry =>
    (typeFilter === "tutti" || entry.type === typeFilter) &&
    (portafoglioFilter === "tutti" || entry.portafoglio === portafoglioFilter) &&
    (entry.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
     entry.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const sortedAndFilteredEntries = getSortedEntries(filteredEntries);

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return sortDirection === "asc" ? <span className="text-blue-600 ml-1">↑</span> : <span className="text-blue-600 ml-1">↓</span>;
  };

  const totalIncome = yearFilteredEntries.filter(e => e.type === "entrata").reduce((sum, entry) => sum + entry.amount, 0);
  const totalExpenses = yearFilteredEntries.filter(e => e.type === "uscita").reduce((sum, entry) => sum + entry.amount, 0);
  const balance = totalIncome - totalExpenses;

  // Calcoli per i saldi separati per portafoglio
  const contanteIncome = yearFilteredEntries.filter(e => e.type === "entrata" && e.portafoglio === "contante").reduce((sum, entry) => sum + entry.amount, 0);
  const contanteExpenses = yearFilteredEntries.filter(e => e.type === "uscita" && e.portafoglio === "contante").reduce((sum, entry) => sum + entry.amount, 0);
  const contanteBalance = contanteIncome - contanteExpenses;

  const contoIncome = yearFilteredEntries.filter(e => e.type === "entrata" && e.portafoglio === "conto").reduce((sum, entry) => sum + entry.amount, 0);
  const contoExpenses = yearFilteredEntries.filter(e => e.type === "uscita" && e.portafoglio === "conto").reduce((sum, entry) => sum + entry.amount, 0);
  const contoBalance = contoIncome - contoExpenses;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingEntry) {
        const { error } = await supabase
          .from('budget_entries')
          .update(formData)
          .eq('id', editingEntry.id);
        
        if (error) throw error;
        
        toast({
          title: "Movimento aggiornato",
          description: "Le modifiche sono state salvate con successo.",
        });
      } else {
        const { error } = await supabase
          .from('budget_entries')
          .insert([formData]);
        
        if (error) throw error;
        
        toast({
          title: "Nuovo movimento aggiunto",
          description: "Il movimento è stato registrato con successo.",
        });
      }

      setIsDialogOpen(false);
      setEditingEntry(null);
      setFormData({
        description: "",
        amount: 0,
        date: "",
        category: "",
        type: "entrata",
        portafoglio: "contante"
      });
      fetchEntries();
    } catch (error) {
      console.error('Error saving budget entry:', error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il movimento.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (entry: BudgetEntry) => {
    setEditingEntry(entry);
    setFormData({
      description: entry.description,
      amount: entry.amount,
      date: entry.date,
      category: entry.category,
      type: entry.type,
      portafoglio: entry.portafoglio
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('budget_entries')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Movimento rimosso",
        description: "Il movimento è stato rimosso dal bilancio.",
        variant: "destructive",
      });
      fetchEntries();
    } catch (error) {
      console.error('Error deleting budget entry:', error);
      toast({
        title: "Errore",
        description: "Impossibile rimuovere il movimento.",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    const tableRows = filteredEntries.map(entry => `
      <tr>
        <td>${new Date(entry.date).toLocaleDateString('it-IT')}</td>
        <td>${entry.description}</td>
        <td>${entry.category}</td>
        <td class="text-center">
          <span class="badge ${entry.type === 'entrata' ? 'badge-success' : 'badge-danger'}">
            ${entry.type === 'entrata' ? 'Entrata' : 'Uscita'}
          </span>
        </td>
        <td class="text-center">
          <span class="badge ${entry.portafoglio === 'contante' ? 'badge-info' : 'badge-warning'}">
            ${entry.portafoglio === 'contante' ? 'Contante' : 'Conto'}
          </span>
        </td>
        <td class="text-right ${entry.type === 'entrata' ? 'text-green' : 'text-red'}">
          ${entry.type === 'entrata' ? '+' : '-'}€${entry.amount.toFixed(2)}
        </td>
      </tr>
    `).join('');

    const printHTML = `
      <div class="summary">
        <h3>Riepilogo Bilancio ${selectedYear}</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <div style="text-align: center; padding: 15px; border: 1px solid #28a745; background-color: #f8fff9;">
            <h4 style="color: #28a745; margin: 0;">ENTRATE</h4>
            <p style="font-size: 24px; font-weight: bold; color: #28a745; margin: 10px 0;">€${totalIncome.toFixed(2)}</p>
          </div>
          <div style="text-align: center; padding: 15px; border: 1px solid #dc3545; background-color: #fff8f8;">
            <h4 style="color: #dc3545; margin: 0;">USCITE</h4>
            <p style="font-size: 24px; font-weight: bold; color: #dc3545; margin: 10px 0;">€${totalExpenses.toFixed(2)}</p>
          </div>
          <div style="text-align: center; padding: 15px; border: 2px solid ${balance >= 0 ? '#28a745' : '#dc3545'}; background-color: ${balance >= 0 ? '#f8fff9' : '#fff8f8'};">
            <h4 style="color: ${balance >= 0 ? '#28a745' : '#dc3545'}; margin: 0;">SALDO</h4>
            <p style="font-size: 24px; font-weight: bold; color: ${balance >= 0 ? '#28a745' : '#dc3545'}; margin: 10px 0;">€${balance.toFixed(2)}</p>
          </div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Descrizione</th>
            <th>Categoria</th>
            <th>Tipo</th>
            <th>Portafoglio</th>
            <th>Importo</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    printContent(printHTML, `Bilancio ${selectedYear}`);
    
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
          <h1 className="text-3xl font-bold text-gray-900">Bilancio</h1>
          <p className="text-gray-600 mt-2">Gestione entrate e uscite dell'associazione</p>
        </div>
        
        <div className="flex items-center space-x-4">
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

          <div className="flex items-center space-x-2">
            <Label htmlFor="year-filter" className="text-sm font-medium">Anno:</Label>
            <select
              id="year-filter"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="p-2 border border-gray-300 rounded-md"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Stampa
          </Button>

          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Import Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Import da Excel</DialogTitle>
                <DialogDescription>
                  Carica un file Excel con i movimenti di bilancio. Il file deve contenere le colonne: Descrizione, Importo, Data, Categoria, Tipo, Portafoglio.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center justify-center w-full">
                  <Label
                    htmlFor="excel-upload"
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileSpreadsheet className="w-8 h-8 mb-4 text-gray-500" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Clicca per caricare</span>
                      </p>
                      <p className="text-xs text-gray-500">Excel (.xlsx, .xls)</p>
                    </div>
                    <Input
                      id="excel-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportExcel}
                      className="hidden"
                    />
                  </Label>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingEntry(null);
                setFormData({
                  description: "",
                  amount: 0,
                  date: "",
                  category: "",
                  type: "entrata",
                  portafoglio: "contante"
                });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Movimento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingEntry ? "Modifica Movimento" : "Nuovo Movimento"}
                </DialogTitle>
                <DialogDescription>
                  {editingEntry ? "Modifica i dati del movimento" : "Aggiungi un nuovo movimento al bilancio"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="description">Descrizione</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Importo (€)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value) || 0})}
                      required
                    />
                  </div>
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
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <Label htmlFor="portafoglio">Portafoglio</Label>
                    <select
                      id="portafoglio"
                      value={formData.portafoglio}
                      onChange={(e) => setFormData({...formData, portafoglio: e.target.value as any})}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="contante">Contante</option>
                      <option value="conto">Conto</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  {editingEntry ? "Aggiorna" : "Aggiungi"} Movimento
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Entrate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              €{totalIncome.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Uscite</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              €{totalExpenses.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Contante</CardTitle>
            <Wallet className={`h-4 w-4 ${contanteBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${contanteBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{contanteBalance.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Conto</CardTitle>
            <CreditCard className={`h-4 w-4 ${contoBalance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${contoBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{contoBalance.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Generale</CardTitle>
            <Calculator className={`h-4 w-4 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{balance.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Movimenti</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {entries.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movimenti di Bilancio</CardTitle>
          <CardDescription>
            {filteredEntries.length} movimenti trovati
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cerca per descrizione o categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded-md"
            >
              <option value="tutti">Tutti i tipi</option>
              <option value="entrata">Entrate</option>
              <option value="uscita">Uscite</option>
            </select>
            <select
              value={portafoglioFilter}
              onChange={(e) => setPortafoglioFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded-md"
            >
              <option value="tutti">Tutti i portafogli</option>
              <option value="contante">Contante</option>
              <option value="conto">Conto</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th 
                    className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                    onClick={() => handleSort("date")}
                  >
                    <div className="flex items-center">
                      Data
                      {getSortIcon("date")}
                    </div>
                  </th>
                  <th 
                    className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                    onClick={() => handleSort("description")}
                  >
                    <div className="flex items-center">
                      Descrizione
                      {getSortIcon("description")}
                    </div>
                  </th>
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
                    onClick={() => handleSort("type")}
                  >
                    <div className="flex items-center">
                      Tipo
                      {getSortIcon("type")}
                    </div>
                  </th>
                  <th 
                    className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                    onClick={() => handleSort("portafoglio")}
                  >
                    <div className="flex items-center">
                      Portafoglio
                      {getSortIcon("portafoglio")}
                    </div>
                  </th>
                  <th 
                    className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                    onClick={() => handleSort("amount")}
                  >
                    <div className="flex items-center">
                      Importo
                      {getSortIcon("amount")}
                    </div>
                  </th>
                  <th className="text-left p-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-gray-600">
                      {new Date(entry.date).toLocaleDateString('it-IT')}
                    </td>
                    <td className="p-2 font-medium">{entry.description}</td>
                    <td className="p-2 text-gray-600">{entry.category}</td>
                    <td className="p-2">
                      <Badge variant={entry.type === "entrata" ? "default" : "destructive"}>
                        {entry.type === "entrata" ? "Entrata" : "Uscita"}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge variant={entry.portafoglio === "contante" ? "secondary" : "outline"}>
                        {entry.portafoglio === "contante" ? "Contante" : "Conto"}
                      </Badge>
                    </td>
                    <td className={`p-2 font-bold ${entry.type === "entrata" ? "text-green-600" : "text-red-600"}`}>
                      {entry.type === "entrata" ? "+" : "-"}€{entry.amount.toFixed(2)}
                    </td>
                    <td className="p-2">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(entry.id)}
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
  );
};
