const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Variabili d'ambiente Supabase non configurate!');
    return res.status(500).json({ success: false, message: 'Configurazione Supabase mancante nel server.' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  if (req.method === 'OPTIONS') {
    // Gestisce le richieste preflight CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).send();
  }

  // Abilita CORS per le richieste reali
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Metodo non consentito. Usa POST.' });
  }

  const { recipients, subject, htmlContent } = req.body;

  if (!recipients || recipients.length === 0 || !subject || !htmlContent) {
    return res.status(400).json({ success: false, message: 'Dati mancanti: destinatari, oggetto e contenuto sono richiesti.' });
  }

  try {
    console.log('Inizializzazione transporter email con:');
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    console.log('SMTP_PORT:', process.env.SMTP_PORT);
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    // Non loggare mai la password reale per sicurezza, ma puoi loggare se è definita
    console.log('EMAIL_PASS definita:', !!process.env.EMAIL_PASS);
    console.log('SMTP_SECURE:', process.env.SMTP_SECURE);

    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true per 465, false per altre porte (587)
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, 
      },
    });

    const results = [];
    const errors = [];

    const CHUNK_SIZE = 20; // Numero di email per blocco
    const DELAY_MS = 5000; // 5 secondi di ritardo tra i blocchi

    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const chunk = recipients.slice(i, i + CHUNK_SIZE);
      console.log(`Inviando blocco ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(recipients.length / CHUNK_SIZE)} (email da ${i + 1} a ${Math.min(i + CHUNK_SIZE, recipients.length)})...`);

      for (const recipient of chunk) {
        try {
          let info = await transporter.sendMail({
            from: process.env.EMAIL_USER, 
            to: recipient,
            subject: subject,
            html: htmlContent,
          });
          console.log(`Email inviata a ${recipient}: %s`, info.messageId);
          results.push({ email: recipient, status: 'sent' });
        } catch (error) {
          console.error(`Errore nell'invio a ${recipient}:`, error);
          errors.push({ email: recipient, error: error.message });
        }
      }

      // Se non è l'ultimo blocco, attendi prima di inviare il prossimo
      if (i + CHUNK_SIZE < recipients.length) {
        console.log(`Attesa di ${DELAY_MS / 1000} secondi prima del prossimo blocco...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }

    // Logica per salvare l'email nello storico di Supabase
    const saveEmailToHistory = async () => {
      try {
        const { data, error } = await supabase
          .from('sent_emails')
          .insert({
            sender_email: process.env.EMAIL_USER,
            recipients: recipients, // Array di stringhe
            subject: subject,
            html_content: htmlContent,
            status: errors.length > 0 ? 'partial_success' : 'sent',
            errors: errors.length > 0 ? errors : null, // Salva gli errori solo se presenti
          });

        if (error) {
          console.error('Errore nel salvataggio storico email su Supabase:', error);
        } else {
          console.log('Email salvata nello storico Supabase:', data);
        }
      } catch (dbError) {
        console.error('Errore critico durante il salvataggio storico email:', dbError);
      }
    };

    // Chiamata la funzione per salvare nello storico (non blocca la risposta al client)
    saveEmailToHistory();

    if (errors.length > 0) {
      return res.status(500).json({
        success: false,
        sent: results.length,
        failed: errors.length,
        results,
        errors,
        message: 'Alcune email non sono state inviate. Controlla gli errori.',
      });
    } else {
      res.status(200).json({
        success: true,
        sent: results.length,
        failed: errors.length,
        results,
        message: 'Email inviate con successo!',
      });
    }

  } catch (error) {
    // Logga l'intero oggetto errore per una diagnostica completa
    console.error('Errore generale del server email (Vercel Function):', error);
    res.status(500).json({ success: false, message: 'Errore interno del server email.' });
  }
}; 