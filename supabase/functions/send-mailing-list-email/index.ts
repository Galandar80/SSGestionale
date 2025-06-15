import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  recipients: string[];
  subject: string;
  htmlContent: string;
}

function sanitizeHtmlContent(html: string): string {
  let sanitized = html.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  const textContent = sanitized.replace(/<[^>]*>/g, '').trim();
  if (!textContent) {
    sanitized = '<p>Messaggio vuoto</p>';
  }
  
  return sanitized;
}

async function sendEmailViaResend(to: string, subject: string, htmlContent: string) {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  
  if (!resendApiKey) {
    throw new Error('Resend API Key not configured. Please set RESEND_API_KEY in Supabase secrets.');
  }

  try {
    console.log(`Sending email to ${to} via Resend`);
    
    const cleanHtmlContent = sanitizeHtmlContent(htmlContent);
    
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev', // Puoi cambiare questo con un tuo dominio verificato in Resend
        to: to,
        subject: subject,
        html: cleanHtmlContent,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Resend API error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    console.log('Email sent via Resend:', result);
    return { success: true, provider: 'Resend' };
    
  } catch (error) {
    console.error('Error sending email to', to, ':', error);
    throw error;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipients, subject, htmlContent }: EmailRequest = await req.json();

    console.log(`Processing email send request for ${recipients.length} recipients`);
    console.log(`Subject: ${subject}`);

    if (!subject || !htmlContent) {
      throw new Error('Subject and htmlContent are required');
    }

    if (recipients.length === 0) {
      throw new Error('No recipients specified');
    }

    const results: { email: string; status: string; provider: string; }[] = [];
    const errors: { email: string; error: string; }[] = [];

    for (const recipient of recipients) {
      try {
        const result = await sendEmailViaResend(recipient, subject, htmlContent);
        results.push({ email: recipient, status: 'sent', provider: result.provider });
        console.log(`Email sent successfully to: ${recipient}`);
      } catch (error) {
        console.error(`Failed to send email to ${recipient}:`, error);
        errors.push({ email: recipient, error: error.message });
      }
    }

    const response = {
      success: errors.length === 0,
      sent: results.length,
      failed: errors.length,
      results,
      errors,
      provider: 'Resend'
    };

    console.log('Email batch completed:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in send-mailing-list-email function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: 'Check function logs for more information'
      }),
      {       status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);
