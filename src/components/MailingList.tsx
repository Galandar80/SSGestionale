import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Users, Search, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { supabase } from "@/integrations/supabase/client";

interface Member {
  id: string;
  name: string;
  surname: string;
  email: string;
  status: "attivo" | "sospeso" | "dimesso";
  membership_fee: boolean;
}

// URL della tua nuova funzione Serverless di Vercel per l'invio email
const EMAIL_SERVICE_URL = "/api/send-email"; 

export const MailingList = () => {
  const { toast } = useToast();
  
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [emailData, setEmailData] = useState({
    subject: "",
    message: ""
  });
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  // Aggiorna data e ora ogni secondo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Manteniamo la fetch dei membri da Supabase
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select('*')
        .order('surname', { ascending: true });
      
      if (error) throw error;
      
      const typedMembers = (data || []).map(member => ({
        ...member,
        status: member.status as "attivo" | "sospeso" | "dimesso"
      }));
      
      setMembers(typedMembers);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare l'elenco soci.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Configurazione dell'editor Quill con toolbar semplificata per evitare problemi
  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['link'],
      ['clean']
    ]
  };

  const quillFormats = [
    'header',
    'bold', 'italic', 'underline',
    'list', 'bullet',
    'link'
  ];

  // Funzione per pulire e validare il contenuto HTML
  const cleanHtmlContent = (html: string): string => {
    if (!html || html.trim() === '') return '';
    
    // Rimuovi eventuali caratteri non validi
    let cleaned = html.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Assicurati che ci sia contenuto testuale
    const textContent = cleaned.replace(/<[^>]*>/g, '').trim();
    if (!textContent) {
      return '';
    }
    
    return cleaned;
  };

  // Filtra i membri che hanno email
  const membersWithEmail = members.filter(member => member.email && member.email.trim() !== "");
  
  const filteredMembers = membersWithEmail.filter(member =>
    member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.surname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedMembers(filteredMembers.map(member => member.id));
    } else {
      setSelectedMembers([]);
    }
  };

  const handleMemberSelect = (memberId: string, checked: boolean) => {
    if (checked) {
      setSelectedMembers([...selectedMembers, memberId]);
    } else {
      setSelectedMembers(selectedMembers.filter(id => id !== memberId));
      setSelectAll(false);
    }
  };

  const handleSendEmail = async () => {
    if (selectedMembers.length === 0) {
      toast({
        title: "Errore",
        description: "Seleziona almeno un destinatario",
        variant: "destructive",
      });
      return;
    }

    if (!emailData.subject.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci l'oggetto dell'email",
        variant: "destructive",
      });
      return;
    }

    const cleanedMessage = cleanHtmlContent(emailData.message);
    if (!cleanedMessage) {
      toast({
        title: "Errore",
        description: "Inserisci il contenuto dell'email",
        variant: "destructive",
      });
      return;
    }

    setSending(true);

    try {
      const selectedMembersList = members.filter(member => selectedMembers.includes(member.id));
      const recipients = selectedMembersList.map(member => member.email);

      console.log("Invio email a:", recipients);
      console.log("Oggetto:", emailData.subject);
      console.log("Messaggio pulito:", cleanedMessage);

      // Chiamata al nuovo servizio Node.js
      const response = await fetch(EMAIL_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: recipients,
          subject: emailData.subject.trim(),
          htmlContent: cleanedMessage
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Errore sconosciuto dal servizio email');
      }

      console.log('Email sending result:', data);

      if (data.success) {
        toast({
          title: "Email inviate!",
          description: `Email inviata con successo a ${data.sent} destinatari${data.failed > 0 ? ` (${data.failed} fallite)` : ''}`,
        });

        if (data.failed > 0) {
          console.warn('Some emails failed:', data.errors);
        }

        // Reset form only if at least some emails were sent
        if (data.sent > 0) {
          setEmailData({ subject: "", message: "" });
          setSelectedMembers([]);
          setSelectAll(false);
        }
      } else {
        throw new Error(data.message || 'Errore sconosciuto durante l\'invio');
      }

    } catch (error: any) {
      console.error('Error sending emails:', error);
      toast({
        title: "Errore nell'invio",
        description: error.message || "Si è verificato un errore durante l'invio delle email. Controlla i log per maggiori dettagli.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      attivo: "bg-green-100 text-green-800",
      sospeso: "bg-yellow-100 text-yellow-800",
      dimesso: "bg-red-100 text-red-800"
    };
    
    return (
      <Badge className={variants[status as keyof typeof variants]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  // Calcola il numero di caratteri senza i tag HTML per l'anteprima
  const getPlainTextLength = (html: string) => {
    if (!html) return 0;
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent?.length || 0;
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mailing List</h1>
          <p className="text-gray-600 mt-2">Invia email di massa ai soci dell'associazione</p>
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
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600">
              {membersWithEmail.length} soci con email
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-600">
              {selectedMembers.length} selezionati
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista destinatari */}
        <Card>
          <CardHeader>
            <CardTitle>Seleziona Destinatari</CardTitle>
            <CardDescription>
              Scegli i soci a cui inviare l'email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Cerca soci..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex items-center space-x-2 pb-2 border-b">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                />
                <Label htmlFor="select-all" className="font-medium">
                  Seleziona tutti ({filteredMembers.length})
                </Label>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-2">
                {filteredMembers.map((member) => (
                  <div key={member.id} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50">
                    <Checkbox
                      id={`member-${member.id}`}
                      checked={selectedMembers.includes(member.id)}
                      onCheckedChange={(checked) => handleMemberSelect(member.id, checked as boolean)}
                    />
                    <div className="flex-1">
                      <div className="font-medium">
                        {member.name} {member.surname}
                      </div>
                      <div className="text-sm text-gray-600">{member.email}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusBadge(member.status)}
                      <Badge variant={member.membership_fee ? "default" : "destructive"}>
                        {member.membership_fee ? "Pagata" : "Non Pagata"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              {filteredMembers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  Nessun socio trovato con i criteri di ricerca
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Composizione email con editor ricco */}
        <Card>
          <CardHeader>
            <CardTitle>Componi Email</CardTitle>
            <CardDescription>
              Scrivi il messaggio da inviare ai destinatari selezionati
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="subject">Oggetto</Label>
                <Input
                  id="subject"
                  placeholder="Inserisci l'oggetto dell'email..."
                  value={emailData.subject}
                  onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="message">Messaggio</Label>
                <div className="mt-2">
                  <ReactQuill
                    theme="snow"
                    value={emailData.message}
                    onChange={(content) => setEmailData({...emailData, message: content})}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="Scrivi il contenuto dell'email..."
                    style={{ height: '250px', marginBottom: '50px' }}
                  />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Anteprima invio</h4>
                <div className="text-sm text-blue-700">
                  <div>Destinatari: {selectedMembers.length} soci</div>
                  <div>Oggetto: {emailData.subject || "Non specificato"}</div>
                  <div>Caratteri messaggio: {getPlainTextLength(emailData.message)}</div>
                  <div className="text-xs mt-1 text-blue-600">
                    L'email sarà inviata tramite la funzione Vercel (Gmail).
                  </div>
                </div>
              </div>

              <Button 
                onClick={handleSendEmail} 
                className="w-full"
                disabled={selectedMembers.length === 0 || !emailData.subject.trim() || !cleanHtmlContent(emailData.message) || sending}
              >
                {sending ? (
                  <>
                    <AlertCircle className="w-4 h-4 mr-2 animate-spin" />
                    Invio in corso...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Invia Email ({selectedMembers.length} destinatari)
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
