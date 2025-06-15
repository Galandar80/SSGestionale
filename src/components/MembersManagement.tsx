import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Users, UserCheck, UserX, Printer, Upload, Download, AlertTriangle, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePrint } from "@/hooks/usePrint";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';

interface Member {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  membership_date: string;
  status: "attivo" | "sospeso" | "dimesso";
  membership_fee: boolean;
  numero_socio?: number;
}

interface AttentionIssue {
  type: 'duplicate_email' | 'duplicate_phone' | 'missing_number';
  message: string;
  members?: Member[];
}

export const MembersManagement = () => {
  const { toast } = useToast();
  const { printContent } = usePrint();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("tutti");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAttentionDialogOpen, setIsAttentionDialogOpen] = useState(false);
  const [isAssigningNumbers, setIsAssigningNumbers] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [attentionIssues, setAttentionIssues] = useState<AttentionIssue[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    email: "",
    phone: "",
    date_of_birth: "",
    membership_date: "",
    status: "attivo" as "attivo" | "sospeso" | "dimesso",
    membership_fee: false,
    numero_socio: ""
  });
  const [sortField, setSortField] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Trasforma i dati e ordina manualmente per numero_socio con i null alla fine
      const typedMembers = (data || []).map(member => ({
        ...member,
        status: member.status as "attivo" | "sospeso" | "dimesso",
        numero_socio: (member as any).numero_socio // Cast temporaneo per gestire il tipo
      })).sort((a, b) => {
        // I membri senza numero vanno alla fine
        if (!a.numero_socio && !b.numero_socio) return 0;
        if (!a.numero_socio) return 1;
        if (!b.numero_socio) return -1;
        return a.numero_socio - b.numero_socio;
      });
      
      setMembers(typedMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i soci.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const assignMemberNumbers = async () => {
    setIsAssigningNumbers(true);
    try {
      // Ottieni tutti i soci ordinati per data di iscrizione (dalla più vecchia)
      const { data: membersData, error: fetchError } = await supabase
        .from('members')
        .select('*')
        .order('membership_date', { ascending: true });
      
      if (fetchError) throw fetchError;
      
      // Ottieni tutti i numeri già assegnati
      const existingNumbers = membersData
        .map(m => m.numero_socio)
        .filter(num => num !== null && num !== undefined)
        .sort((a, b) => a - b);
      
      console.log('Numeri esistenti:', existingNumbers);
      
      // Trova tutti i numeri mancanti nella sequenza
      const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      const missingNumbers = [];
      
      // Trova i buchi nella numerazione
      for (let i = 1; i <= maxNumber; i++) {
        if (!existingNumbers.includes(i)) {
          missingNumbers.push(i);
        }
      }
      
      // Aggiungi i numeri successivi per i soci rimanenti
      let nextNumber = maxNumber + 1;
      
      console.log('Numeri mancanti:', missingNumbers);
      console.log('Prossimo numero dopo il massimo:', nextNumber);
      
      let updatedCount = 0;
      let errorCount = 0;
      
      // Filtra solo i soci senza numero
      const membersWithoutNumber = membersData.filter(member => !member.numero_socio);
      
      // Assegna i numeri ai soci che non ne hanno uno
      for (let i = 0; i < membersWithoutNumber.length; i++) {
        const member = membersWithoutNumber[i];
        
        // Usa prima i numeri mancanti, poi quelli progressivi
        const assignedNumber = i < missingNumbers.length ? missingNumbers[i] : nextNumber++;
        
        try {
          const { error: updateError } = await supabase
            .from('members')
            .update({ numero_socio: assignedNumber })
            .eq('id', member.id);
          
          if (updateError) {
            console.error(`Errore aggiornamento socio ${member.name} ${member.surname}:`, updateError);
            errorCount++;
          } else {
            console.log(`Assegnato numero ${assignedNumber} a ${member.name} ${member.surname}`);
            updatedCount++;
          }
        } catch (error) {
          console.error(`Errore durante aggiornamento socio ${member.name} ${member.surname}:`, error);
          errorCount++;
        }
      }
      
      if (errorCount > 0) {
        toast({
          title: "Assegnazione parzialmente completata",
          description: `${updatedCount} numeri assegnati, ${errorCount} errori.`,
          variant: "destructive",
        });
      } else if (updatedCount === 0) {
        toast({
          title: "Nessun numero da assegnare",
          description: "Tutti i soci hanno già un numero assegnato.",
        });
      } else {
        toast({
          title: "Numerazione completata",
          description: `Assegnati ${updatedCount} nuovi numeri soci.`,
        });
      }
      
      // Ricarica i dati
      fetchMembers();
      
    } catch (error) {
      console.error('Error assigning member numbers:', error);
      toast({
        title: "Errore",
        description: "Impossibile assegnare i numeri soci.",
        variant: "destructive",
      });
    } finally {
      setIsAssigningNumbers(false);
    }
  };

  const totalMembers = members.length;
  const activeMembers = members.filter(m => m.status === "attivo").length;
  const suspendedMembers = members.filter(m => m.status === "sospeso").length;
  const resignedMembers = members.filter(m => m.status === "dimesso").length;
  const paidMembers = members.filter(m => m.membership_fee).length;

  const filteredMembers = members.filter(member =>
    (statusFilter === "tutti" || member.status === statusFilter) &&
    (member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     member.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
     member.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const submitData = {
        ...formData,
        numero_socio: formData.numero_socio ? parseInt(formData.numero_socio) : null
      };

      if (editingMember) {
        const { error } = await supabase
          .from('members')
          .update(submitData)
          .eq('id', editingMember.id);
        
        if (error) throw error;
        
        toast({
          title: "Socio aggiornato",
          description: "Le modifiche sono state salvate con successo.",
        });
      } else {
        const { error } = await supabase
          .from('members')
          .insert([submitData]);
        
        if (error) throw error;
        
        toast({
          title: "Nuovo socio aggiunto",
          description: "Il socio è stato registrato con successo.",
        });
      }

      setIsDialogOpen(false);
      setEditingMember(null);
      setFormData({
        name: "",
        surname: "",
        email: "",
        phone: "",
        date_of_birth: "",
        membership_date: "",
        status: "attivo",
        membership_fee: false,
        numero_socio: ""
      });
      fetchMembers();
    } catch (error) {
      console.error('Error saving member:', error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il socio.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      surname: member.surname,
      email: member.email,
      phone: member.phone || "",
      date_of_birth: member.date_of_birth || "",
      membership_date: member.membership_date,
      status: member.status,
      membership_fee: member.membership_fee,
      numero_socio: member.numero_socio ? member.numero_socio.toString() : ""
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      toast({
        title: "Socio rimosso",
        description: "Il socio è stato rimosso dal libro soci.",
        variant: "destructive",
      });
      fetchMembers();
    } catch (error) {
      console.error('Error deleting member:', error);
      toast({
        title: "Errore",
        description: "Impossibile rimuovere il socio.",
        variant: "destructive",
      });
    }
  };

  const handleQuickStatusChange = async (memberId: string, currentStatus: "attivo" | "sospeso" | "dimesso") => {
    const statusCycle = {
      "attivo": "sospeso",
      "sospeso": "dimesso", 
      "dimesso": "attivo"
    } as const;
    
    const newStatus = statusCycle[currentStatus];
    
    try {
      const { error } = await supabase
        .from('members')
        .update({ status: newStatus })
        .eq('id', memberId);
      
      if (error) throw error;
      
      toast({
        title: "Stato aggiornato",
        description: `Stato cambiato da ${currentStatus} a ${newStatus}`,
      });
      
      fetchMembers();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato del socio.",
        variant: "destructive",
      });
    }
  };

  const handleQuickFeeChange = async (memberId: string, currentFee: boolean) => {
    const newFee = !currentFee;
    
    try {
      const { error } = await supabase
        .from('members')
        .update({ membership_fee: newFee })
        .eq('id', memberId);
      
      if (error) throw error;
      
      toast({
        title: "Quota aggiornata",
        description: `Quota ${newFee ? 'pagata' : 'non pagata'}`,
      });
      
      fetchMembers();
    } catch (error) {
      console.error('Error updating fee:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la quota del socio.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string, memberId: string) => {
    const variants = {
      attivo: "bg-green-100 text-green-800 hover:bg-green-200",
      sospeso: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200",
      dimesso: "bg-red-100 text-red-800 hover:bg-red-200"
    };
    
    return (
      <button
        onClick={() => handleQuickStatusChange(memberId, status as "attivo" | "sospeso" | "dimesso")}
        className={`${variants[status as keyof typeof variants]} px-2 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </button>
    );
  };

  const getFeeButton = (fee: boolean, memberId: string) => {
    return (
      <button
        onClick={() => handleQuickFeeChange(memberId, fee)}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
          fee 
            ? "bg-green-100 text-green-800 hover:bg-green-200" 
            : "bg-red-100 text-red-800 hover:bg-red-200"
        }`}
      >
        {fee ? "Pagata" : "Non Pagata"}
      </button>
    );
  };

  const determineStatusAndFee = (annotazioni: string, annoRinnovo: string) => {
    const annotazioniLower = (annotazioni || '').toLowerCase().trim();
    const annoRinnovoStr = String(annoRinnovo || '').trim();
    
    console.log('Annotazioni:', annotazioni, 'Anno Rinnovo:', annoRinnovo);
    
    // Controllo specifico per "Socio Decaduto"
    if (annotazioniLower.includes('socio decaduto')) {
      return { status: 'dimesso' as const, membership_fee: false };
    }
    
    // Controllo specifico per "Decaduto"
    if (annotazioniLower.includes('decaduto')) {
      return { status: 'dimesso' as const, membership_fee: false };
    }
    
    // Controllo per "Rinnovato Tesseramento 2025"
    if (annotazioniLower.includes('rinnovato tesseramento 2025')) {
      return { status: 'attivo' as const, membership_fee: true };
    }
    
    // Controllo per "Attivo"
    if (annotazioniLower.includes('attivo')) {
      return { status: 'attivo' as const, membership_fee: true };
    }
    
    // Controllo per "Rinnovato Tesseramento 2024 - Rinnovato Tesseramento 2025"
    if (annotazioniLower.includes('rinnovato tesseramento 2024') && annotazioniLower.includes('rinnovato tesseramento 2025')) {
      return { status: 'attivo' as const, membership_fee: true };
    }
    
    // Controllo per Anno Rinnovo 2025
    if (annoRinnovoStr === '2025') {
      return { status: 'attivo' as const, membership_fee: true };
    }
    
    // Default: attivo e non pagato
    return { status: 'attivo' as const, membership_fee: false };
  };

  const handleExportExcel = () => {
    try {
      const exportData = members.map(member => ({
        'Numero Socio': member.numero_socio || '',
        'Nome': member.name,
        'Cognome': member.surname,
        'Email': member.email || '',
        'Telefono': member.phone || '',
        'Data Nascita': member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString('it-IT') : '',
        'Data Iscrizione': new Date(member.membership_date).toLocaleDateString('it-IT'),
        'Stato': member.status.charAt(0).toUpperCase() + member.status.slice(1),
        'Quota Pagata': member.membership_fee ? 'Sì' : 'No'
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Soci");
      
      const fileName = `libro_soci_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Export completato",
        description: `File ${fileName} scaricato con successo.`,
      });
    } catch (error) {
      console.error('Error exporting Excel:', error);
      toast({
        title: "Errore",
        description: "Impossibile esportare il file Excel.",
        variant: "destructive",
      });
    }
  };

  const checkAttentionIssues = () => {
    const issues: AttentionIssue[] = [];
    
    // Controlla email duplicate (ignorando quelle vuote)
    const emailGroups = members
      .filter(m => m.email && m.email.trim() !== '')
      .reduce((acc, member) => {
        const email = member.email.toLowerCase();
        if (!acc[email]) acc[email] = [];
        acc[email].push(member);
        return acc;
      }, {} as Record<string, Member[]>);
    
    Object.entries(emailGroups).forEach(([email, memberList]) => {
      if (memberList.length > 1) {
        issues.push({
          type: 'duplicate_email',
          message: `Email duplicata: ${email}`,
          members: memberList
        });
      }
    });
    
    // Controlla telefoni duplicati (ignorando quelli vuoti)
    const phoneGroups = members
      .filter(m => m.phone && m.phone.trim() !== '')
      .reduce((acc, member) => {
        const phone = member.phone!.trim();
        if (!acc[phone]) acc[phone] = [];
        acc[phone].push(member);
        return acc;
      }, {} as Record<string, Member[]>);
    
    Object.entries(phoneGroups).forEach(([phone, memberList]) => {
      if (memberList.length > 1) {
        issues.push({
          type: 'duplicate_phone',
          message: `Telefono duplicato: ${phone}`,
          members: memberList
        });
      }
    });
    
    // Controlla numerazione mancante
    const numberedMembers = members.filter(m => m.numero_socio);
    if (numberedMembers.length > 0) {
      const numbers = numberedMembers.map(m => m.numero_socio!).sort((a, b) => a - b);
      const maxNumber = Math.max(...numbers);
      
      for (let i = 1; i <= maxNumber; i++) {
        if (!numbers.includes(i)) {
          issues.push({
            type: 'missing_number',
            message: `Numero socio mancante: ${i}`,
          });
        }
      }
    }
    
    setAttentionIssues(issues);
    setIsAttentionDialogOpen(true);
    
    if (issues.length === 0) {
      toast({
        title: "Tutto OK!",
        description: "Nessun problema trovato nei dati dei soci.",
      });
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      console.log('Dati raw da Excel:', jsonData);

      // Ottieni tutti i soci esistenti nel database
      const { data: existingMembers, error: fetchError } = await supabase
        .from('members')
        .select('*');
      
      if (fetchError) throw fetchError;
      
      // Crea una mappa degli esistenti per email (solo per email non vuote)
      const existingMembersMap = new Map(
        existingMembers
          .filter(m => m.email && m.email.trim() !== '')
          .map(m => [m.email.toLowerCase(), m])
      );

      const newMembers = [];
      const updatedMembers = [];
      const invalidRows = [];
      const today = new Date().toISOString().split('T')[0];

      jsonData.forEach((row: any, index: number) => {
        console.log(`Riga ${index + 1}:`, row);
        
        // Mappiamo i dati dal formato Excel alla nostra struttura
        const name = row['Nome'] ? String(row['Nome']).trim() : '';
        const surname = row['Cognome'] ? String(row['Cognome']).trim() : '';
        const email = row['Email'] ? String(row['Email']).trim() : '';
        const annotazioni = row['Annotazioni'] || row['annotazioni'] || '';
        const annoRinnovo = row['Anno Rinnovo'] || row['anno rinnovo'] || '';
        const numeroSocio = row['Numero Socio'] || row['numero socio'] || null;
        
        // Se non c'è né nome né cognome, salta la riga
        if (!name && !surname) {
          invalidRows.push(index + 2); // +2 perché Excel inizia da 1 e c'è l'header
          return;
        }

        // Gestione della data di ammissione - se non presente o non valida, usa la data odierna
        let membershipDate = today;
        
        if (row['Data Ammissione']) {
          const parsedMembershipDate = formatExcelDate(row['Data Ammissione']);
          if (parsedMembershipDate && !parsedMembershipDate.startsWith('1923') && !parsedMembershipDate.startsWith('1900')) {
            membershipDate = parsedMembershipDate;
          } else {
            console.log(`Data di ammissione non valida per ${name} ${surname}: ${row['Data Ammissione']}, uso data di oggi`);
          }
        }

        // Gestione della data di nascita - se non presente o non valida, lascia vuoto
        const dateOfBirth = row['Data Nascita'] ? 
          formatExcelDate(row['Data Nascita']) : 
          null;
        
        // Determina stato e quota basandosi su annotazioni e anno rinnovo
        const { status, membership_fee } = determineStatusAndFee(annotazioni, annoRinnovo);

        const memberData = {
          name: name || '',
          surname: surname || '',
          email: email || '', // Può essere vuoto, ora è supportato dal database
          phone: row['Telefono'] ? String(row['Telefono']).trim() : '',
          date_of_birth: dateOfBirth,
          membership_date: membershipDate,
          status: status,
          membership_fee: membership_fee,
          numero_socio: numeroSocio ? parseInt(String(numeroSocio)) : null
        };

        console.log(`Socio ${name} ${surname}: Status=${status}, Fee=${membership_fee}, Email="${email}", Numero=${numeroSocio}`);

        // Controlla se il socio esiste già (solo se ha email non vuota)
        if (email && email.trim() !== '') {
          const existingMember = existingMembersMap.get(email.toLowerCase());
          if (existingMember) {
            // Aggiungi l'ID per l'update
            updatedMembers.push({
              ...memberData,
              id: existingMember.id
            });
            return;
          }
        }

        // Nuovo socio
        newMembers.push(memberData);
      });

      console.log('Soci nuovi da inserire:', newMembers.length);
      console.log('Soci esistenti da aggiornare:', updatedMembers.length);
      console.log('Righe non valide:', invalidRows.length);

      // Mostra messaggi informativi sui problemi trovati
      if (invalidRows.length > 0) {
        toast({
          title: "Righe saltate",
          description: `Saltate ${invalidRows.length} righe senza nome e cognome (righe: ${invalidRows.slice(0, 5).join(', ')}${invalidRows.length > 5 ? '...' : ''})`,
        });
      }

      if (newMembers.length === 0 && updatedMembers.length === 0) {
        toast({
          title: "Nessun socio da importare",
          description: "Tutte le righe sono vuote o non valide.",
          variant: "destructive",
        });
        return;
      }

      // Inserimento nuovi soci
      let insertedCount = 0;
      
      if (newMembers.length > 0) {
        console.log('Inserimento nuovi soci...');
        
        for (const [index, member] of newMembers.entries()) {
          try {
            console.log(`Inserendo socio ${index + 1}/${newMembers.length}:`, member.name, member.surname);
            
            const { data: insertResult, error: insertError } = await supabase
              .from('members')
              .insert([member])
              .select();

            if (insertError) {
              console.error('Errore inserimento socio:', member.name, member.surname, insertError);
            } else {
              insertedCount++;
              console.log('Socio inserito con successo:', insertResult);
            }
          } catch (error) {
            console.error('Errore durante inserimento socio:', member.name, member.surname, error);
          }
        }
      }

      // Aggiornamento soci esistenti
      let updatedCount = 0;
      
      for (const member of updatedMembers) {
        try {
          const { id, ...memberDataWithoutId } = member;
          const { error: updateError } = await supabase
            .from('members')
            .update(memberDataWithoutId)
            .eq('id', id);

          if (updateError) {
            console.error('Errore aggiornamento socio:', member.email, updateError);
          } else {
            updatedCount++;
          }
        } catch (error) {
          console.error('Errore aggiornamento socio:', member.email, error);
        }
      }

      toast({
        title: "Import completato",
        description: `Importati ${insertedCount} nuovi soci e aggiornati ${updatedCount} soci esistenti.`,
      });

      setIsImportDialogOpen(false);
      fetchMembers();
      
      // Reset dell'input file
      event.target.value = '';
    } catch (error) {
      console.error('Errore durante l\'import:', error);
      toast({
        title: "Errore durante l'import",
        description: error instanceof Error ? error.message : "Errore sconosciuto durante l'importazione del file.",
        variant: "destructive",
      });
    }
  };

  const formatExcelDate = (excelDate: any) => {
    console.log('Formattazione data:', excelDate, typeof excelDate);
    
    if (typeof excelDate === 'number') {
      // Excel date serial number
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    } else if (typeof excelDate === 'string') {
      // Try to parse string date in various formats
      const cleanDate = excelDate.trim();
      
      // Formato DD/MM/YYYY
      if (cleanDate.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const [day, month, year] = cleanDate.split('/');
        const parsedYear = parseInt(year);
        
        // Controlla se l'anno è ragionevole (evita date come 1923 che sono chiaramente errori)
        if (parsedYear < 1950 || parsedYear > new Date().getFullYear()) {
          console.log(`Anno non valido: ${parsedYear}`);
          return null;
        }
        
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Formato DD-MM-YYYY
      if (cleanDate.match(/^\d{2}-\d{2}-\d{4}$/)) {
        const [day, month, year] = cleanDate.split('-');
        const parsedYear = parseInt(year);
        
        if (parsedYear < 1950 || parsedYear > new Date().getFullYear()) {
          console.log(`Anno non valido: ${parsedYear}`);
          return null;
        }
        
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Altri formati, prova il parsing diretto
      const date = new Date(cleanDate);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        if (year < 1950 || year > new Date().getFullYear()) {
          console.log(`Anno non valido dal parsing diretto: ${year}`);
          return null;
        }
        return date.toISOString().split('T')[0];
      }
    }
    return null;
  };

  const handlePrint = () => {
    const tableRows = filteredMembers.map(member => `
      <tr>
        <td>${member.numero_socio || 'N/A'}</td>
        <td>${member.surname}</td>
        <td>${member.name}</td>
        <td>${member.email}</td>
        <td>${member.phone || 'N/D'}</td>
        <td class="text-center">${member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString('it-IT') : 'N/D'}</td>
        <td class="text-center">${new Date(member.membership_date).toLocaleDateString('it-IT')}</td>
        <td class="text-center">
          <span class="badge ${
            member.status === 'attivo' ? 'badge-success' : 
            member.status === 'sospeso' ? 'badge-warning' : 'badge-danger'
          }">
            ${member.status.charAt(0).toUpperCase() + member.status.slice(1)}
          </span>
        </td>
        <td class="text-center">
          <span class="badge ${member.membership_fee ? 'badge-success' : 'badge-danger'}">
            ${member.membership_fee ? 'Pagata' : 'Non Pagata'}
          </span>
        </td>
      </tr>
    `).join('');

    const printHTML = `
      <div class="summary">
        <h3>Riepilogo Libro Soci</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
          <div>
            <p><strong>Totale Soci:</strong> ${totalMembers}</p>
            <p><strong>Soci Attivi:</strong> ${activeMembers}</p>
            <p><strong>Soci Sospesi:</strong> ${suspendedMembers}</p>
            <p><strong>Soci Dimessi:</strong> ${resignedMembers}</p>
          </div>
          <div>
            <p><strong>Quote Pagate:</strong> ${paidMembers}</p>
            <p><strong>Quote Non Pagate:</strong> ${totalMembers - paidMembers}</p>
            <p><strong>Percentuale Pagamenti:</strong> ${totalMembers > 0 ? ((paidMembers / totalMembers) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>N°</th>
            <th>Cognome</th>
            <th>Nome</th>
            <th>Email</th>
            <th>Telefono</th>
            <th>Data Nascita</th>
            <th>Data Iscrizione</th>
            <th>Stato</th>
            <th>Quota</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    printContent(printHTML, "Libro Soci");
    
    toast({
      title: "Stampa avviata",
      description: "Il documento è stato inviato alla stampante.",
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortedMembers = (members: Member[]) => {
    if (!sortField) return members;

    return [...members].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "numero_socio":
          aValue = a.numero_socio || 0;
          bValue = b.numero_socio || 0;
          break;
        case "name":
          aValue = `${a.surname} ${a.name}`.toLowerCase();
          bValue = `${b.surname} ${b.name}`.toLowerCase();
          break;
        case "email":
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case "date_of_birth":
          aValue = a.date_of_birth ? new Date(a.date_of_birth) : new Date(0);
          bValue = b.date_of_birth ? new Date(b.date_of_birth) : new Date(0);
          break;
        case "membership_date":
          aValue = new Date(a.membership_date);
          bValue = new Date(b.membership_date);
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "membership_fee":
          aValue = a.membership_fee ? 1 : 0;
          bValue = b.membership_fee ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  };

  const sortedAndFilteredMembers = getSortedMembers(filteredMembers);

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return sortDirection === "asc" ? <span className="text-blue-600 ml-1">↑</span> : <span className="text-blue-600 ml-1">↓</span>;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Libro Soci</h1>
          <p className="text-gray-600 mt-2">Gestione dei soci dell'associazione</p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            onClick={assignMemberNumbers}
            disabled={isAssigningNumbers}
            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <Hash className="w-4 h-4 mr-2" />
            {isAssigningNumbers ? "Assegnando..." : "Assegna Numeri"}
          </Button>

          <Button variant="outline" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Stampa
          </Button>

          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="w-4 h-4 mr-2" />
            Esporta Excel
          </Button>

          <Button 
            variant="outline" 
            onClick={checkAttentionIssues}
            className={attentionIssues.length > 0 ? "text-red-600 border-red-600" : ""}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Attenzione
          </Button>

          <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="w-4 h-4 mr-2" />
                Importa Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Importa Soci da Excel</DialogTitle>
                <DialogDescription>
                  Seleziona un file Excel. È richiesto almeno uno tra Nome o Cognome. Tutti gli altri campi sono opzionali.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="excel-file">File Excel</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileImport}
                  />
                </div>
                <div className="text-sm text-gray-600">
                  <p><strong>Colonne supportate nel file Excel:</strong></p>
                  <ul className="list-disc list-inside mt-2">
                    <li><strong>Numero Socio</strong> (opzionale)</li>
                    <li><strong>Nome</strong> (almeno uno tra Nome o Cognome richiesto)</li>
                    <li><strong>Cognome</strong> (almeno uno tra Nome o Cognome richiesto)</li>
                    <li><strong>Email</strong> (opzionale - può essere vuoto)</li>
                    <li><strong>Telefono</strong> (opzionale)</li>
                    <li><strong>Data Nascita</strong> (opzionale)</li>
                    <li><strong>Data Ammissione</strong> (opzionale - se vuota usa oggi)</li>
                    <li><strong>Annotazioni</strong> (opzionale - determina stato e quota)</li>
                    <li><strong>Anno Rinnovo</strong> (opzionale)</li>
                  </ul>
                  <p className="mt-2 text-xs">
                    <strong>Note:</strong> I soci con email già esistenti verranno aggiornati. 
                    I campi vuoti rimarranno vuoti.
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAttentionDialogOpen} onOpenChange={setIsAttentionDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Controllo Attenzione</DialogTitle>
                <DialogDescription>
                  Problemi rilevati nei dati dei soci
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {attentionIssues.length === 0 ? (
                  <p className="text-green-600">✅ Nessun problema rilevato!</p>
                ) : (
                  attentionIssues.map((issue, index) => (
                    <div key={index} className="border rounded p-3">
                      <p className="font-medium text-red-600">{issue.message}</p>
                      {issue.members && (
                        <div className="mt-2">
                          <p className="text-sm text-gray-600">Soci coinvolti:</p>
                          <ul className="text-sm">
                            {issue.members.map(member => (
                              <li key={member.id}>
                                {member.surname} {member.name} 
                                {member.numero_socio && ` (N° ${member.numero_socio})`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingMember(null);
                setFormData({
                  name: "",
                  surname: "",
                  email: "",
                  phone: "",
                  date_of_birth: "",
                  membership_date: "",
                  status: "attivo",
                  membership_fee: false,
                  numero_socio: ""
                });
              }}>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Socio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingMember ? "Modifica Socio" : "Nuovo Socio"}
                </DialogTitle>
                <DialogDescription>
                  {editingMember ? "Modifica i dati del socio" : "Aggiungi un nuovo socio al libro"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="numero_socio">Numero Socio</Label>
                  <Input
                    id="numero_socio"
                    type="number"
                    value={formData.numero_socio}
                    onChange={(e) => setFormData({...formData, numero_socio: e.target.value})}
                    placeholder="Opzionale"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="surname">Cognome</Label>
                    <Input
                      id="surname"
                      value={formData.surname}
                      onChange={(e) => setFormData({...formData, surname: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefono</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="date_of_birth">Data Nascita</Label>
                    <Input
                      id="date_of_birth"
                      type="date"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({...formData, date_of_birth: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="membership_date">Data Iscrizione</Label>
                    <Input
                      id="membership_date"
                      type="date"
                      value={formData.membership_date}
                      onChange={(e) => setFormData({...formData, membership_date: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="status">Stato</Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="attivo">Attivo</option>
                    <option value="sospeso">Sospeso</option>
                    <option value="dimesso">Dimesso</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    id="membership_fee"
                    type="checkbox"
                    checked={formData.membership_fee}
                    onChange={(e) => setFormData({...formData, membership_fee: e.target.checked})}
                  />
                  <Label htmlFor="membership_fee">Quota pagata</Label>
                </div>
                <Button type="submit" className="w-full">
                  {editingMember ? "Aggiorna" : "Aggiungi"} Socio
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Soci</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attivi</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sospesi</CardTitle>
            <UserX className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{suspendedMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dimessi</CardTitle>
            <UserX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{resignedMembers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quote Pagate</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidMembers}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Soci</CardTitle>
          <CardDescription>
            {filteredMembers.length} soci trovati - Clicca su stato e quota per modificarli rapidamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cerca per nome, cognome o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 border border-gray-300 rounded-md"
            >
              <option value="tutti">Tutti</option>
              <option value="attivo">Attivi</option>
              <option value="sospeso">Sospesi</option>
              <option value="dimesso">Dimessi</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th 
                    className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                    onClick={() => handleSort("numero_socio")}
                  >
                    <div className="flex items-center">
                      N°
                      {getSortIcon("numero_socio")}
                    </div>
                  </th>
                  <th 
                    className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Nome
                      {getSortIcon("name")}
                    </div>
                  </th>
                  <th 
                    className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                    onClick={() => handleSort("email")}
                  >
                    <div className="flex items-center">
                      Email
                      {getSortIcon("email")}
                    </div>
                  </th>
                  <th className="text-left p-2">Telefono</th>
                  <th 
                    className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                    onClick={() => handleSort("date_of_birth")}
                  >
                    <div className="flex items-center">
                      Data Nascita
                      {getSortIcon("date_of_birth")}
                    </div>
                  </th>
                  <th 
                    className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                    onClick={() => handleSort("membership_date")}
                  >
                    <div className="flex items-center">
                      Data Iscrizione
                      {getSortIcon("membership_date")}
                    </div>
                  </th>
                  <th 
                    className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                    onClick={() => handleSort("status")}
                  >
                    <div className="flex items-center">
                      Stato
                      {getSortIcon("status")}
                    </div>
                  </th>
                  <th 
                    className="text-left p-2 cursor-pointer hover:bg-gray-50 select-none" 
                    onClick={() => handleSort("membership_fee")}
                  >
                    <div className="flex items-center">
                      Quota
                      {getSortIcon("membership_fee")}
                    </div>
                  </th>
                  <th className="text-left p-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFilteredMembers.map((member) => (
                  <tr key={member.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 font-medium">{member.numero_socio || "N/A"}</td>
                    <td className="p-2 font-medium">{member.surname} {member.name}</td>
                    <td className="p-2 text-gray-600">{member.email || "N/A"}</td>
                    <td className="p-2 text-gray-600">{member.phone || "N/A"}</td>
                    <td className="p-2 text-gray-600">
                      {member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString('it-IT') : "N/A"}
                    </td>
                    <td className="p-2 text-gray-600">
                      {new Date(member.membership_date).toLocaleDateString('it-IT')}
                    </td>
                    <td className="p-2">{getStatusBadge(member.status, member.id)}</td>
                    <td className="p-2">{getFeeButton(member.membership_fee, member.id)}</td>
                    <td className="p-2">
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(member)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(member.id)}
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
