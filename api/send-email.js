const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
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

    for (const recipient of recipients) {
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
    console.error('Errore del server email (Vercel Function):', error);
    res.status(500).json({ success: false, message: 'Errore interno del server email.' });
  }
}; 