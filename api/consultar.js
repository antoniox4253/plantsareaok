// Vercel Serverless Function: POST /api/consultar
// Proxy inverso seguro para consulta de códigos de streaming

export const config = {
  maxDuration: 20
};

const PROVIDER_ENDPOINT_URL =
  process.env.PROVIDER_ENDPOINT_URL ||
  'https://api.starlatinotv.org/api/cuenta/verificarcodigo';

const PROVIDER_METHOD = (process.env.PROVIDER_METHOD || 'GET').toUpperCase();

const PROVIDER_HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'X-Tenant-ID': process.env.PROVIDER_TENANT_ID || 'samuelinho',
  'Origin': process.env.PROVIDER_ORIGIN || 'https://samuelinho.com',
  'Referer': process.env.PROVIDER_REFERER || 'https://samuelinho.com/code',
  ...(process.env.PROVIDER_AUTH_TOKEN
    ? { Authorization: `Bearer ${process.env.PROVIDER_AUTH_TOKEN}` }
    : {}),
  ...(process.env.PROVIDER_COOKIE ? { Cookie: process.env.PROVIDER_COOKIE } : {})
};

const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 15000;

// Utilidades de extracción
const cleanHtml = (html) => {
  if (!html || typeof html !== 'string') return '';
  let t = html.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  t = t.replace(/<[^>]+>/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
};

const decodeEntities = (str) => {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
};

const findLink = (html, domains) => {
  for (const domain of domains) {
    const regex = new RegExp(`<a[^>]*href="([^"]*${domain}[^"]*)"[^>]*>[\\s\\S]*?<\\/a>`, 'i');
    const match = html.match(regex);
    if (match) return { type: 'link', value: match[1] };
  }
  return null;
};

const extractDigits = (html, length) => {
  const text = decodeEntities(cleanHtml(html));
  const regex = new RegExp(`(?<![\\d#])(\\d{${length}})(?![\\d])`, 'g');
  const matches = [...text.matchAll(regex)];
  return matches.length ? { type: 'code', value: matches[0][1] } : null;
};

const extractAlphanumeric = (html, length) => {
  const text = decodeEntities(cleanHtml(html));
  const regex = new RegExp(`(?<![A-Z0-9#])([A-Z0-9]{${length}})(?![A-Z0-9])`, 'g');
  const matches = [...text.matchAll(regex)].filter(
    (u) => /[A-Z]/.test(u[1]) && /[0-9]/.test(u[1])
  );
  return matches.length ? { type: 'code', value: matches[0][1] } : null;
};

const platformExtractors = {
  netflix: (body) => {
    const tdMatch = body.match(
      /<td[^>]*(?:font-size:\s*(?:2[0-9]|3[0-9])px|letter-spacing)[^>]*>\s*(\d{4,6})\s*<\/td>/i
    );
    if (tdMatch) return { type: 'code', value: tdMatch[1] };
    const btnMatch = body.match(/<table[^>]*class="[^"]*inner-button[^"]*"[^>]*>[\s\S]*?<\/table>/i);
    if (btnMatch) return { type: 'html', value: btnMatch[0] };
    return extractDigits(body, 6) || extractDigits(body, 4) || null;
  },
  disney: (body) => {
    const match = body.match(
      /<(?:td|span|p|h[1-6])[^>]*(?:letter-spacing|font-size:\s*[2-9]\d)[^>]*>\s*(\d{6})\s*<\/(?:td|span|p|h[1-6])>/i
    );
    if (match) return { type: 'code', value: match[1] };
    const plusMatch = body.match(/\+[\s\S]*?>[\s]*?(\d{6})[\s]*?</);
    if (plusMatch) return { type: 'code', value: plusMatch[1] };
    return extractDigits(body, 6);
  },
  primevideo: (body) => {
    const cleaned = decodeEntities(cleanHtml(body));
    const codeMatch = cleaned.match(
      /(?:c[oó]digo de verificaci[oó]n(?: es)?|verification code(?: is)?)\s*:?\s*(\d{6})/i
    );
    if (codeMatch) return { type: 'code', value: codeMatch[1] };
    const tagMatch = body.match(
      /(?:c[oó]digo de verificaci[oó]n(?: es)?|verification code(?: is)?)[\s\S]*?>\s*(\d{6})\s*</i
    );
    if (tagMatch) return { type: 'code', value: tagMatch[1] };
    return extractDigits(body, 6);
  },
  spotify: (body) => extractDigits(body, 6),
  chatgpt: (body) => extractDigits(body, 6),
  freepik: (body) => extractDigits(body, 6),
  perplexity: (body) => extractDigits(body, 6),
  appletv: (body) => {
    const match = body.match(
      /<(?:td|span|p)[^>]*(?:font-size:\s*[2-9]\d|letter-spacing)[^>]*>\s*(\d{6})\s*<\/(?:td|span|p)>/i
    );
    if (match) return { type: 'code', value: match[1] };
    const tagMatch = body.match(/>\s*(\d{6})\s*</);
    if (tagMatch) return { type: 'code', value: tagMatch[1] };
    return extractDigits(body, 6);
  },
  crunchyroll: (body) => {
    const match = body.match(
      /(?:Restablecer|Reset|Confirm|Verif|Valid)[\s\S]{0,400}?<a[^>]*href="([^"]*links\.mail\.crunchyroll\.com\/ls\/click[^"]*)"/i
    );
    if (match) return { type: 'link', value: match[1] };
    const domainMatch = findLink(body, [
      'crunchyroll.com/confirmaccount',
      'crunchyroll.com/login',
      'crunchyroll.com/reset'
    ]);
    if (domainMatch) return domainMatch;
    const clickRegex = /<a[^>]*href="([^"]*links\.mail\.crunchyroll\.com\/ls\/click[^"]*)"/gi;
    const clickMatches = [...body.matchAll(clickRegex)];
    if (clickMatches.length > 0) {
      clickMatches.sort((a, b) => b[1].length - a[1].length);
      return { type: 'link', value: clickMatches[0][1] };
    }
    return extractDigits(body, 6);
  },
  universal: (body) => {
    const letterMatch = body.match(/>\s*([A-Z]{6})\s*</);
    if (letterMatch) return { type: 'code', value: letterMatch[1] };
    return extractAlphanumeric(body, 6);
  },
  vikirakuten: (body) =>
    findLink(body, ['reset-password', 'resetpassword', 'verify']) || extractDigits(body, 6),
  paramount: (body) =>
    findLink(body, ['changepassword', 'manage-devices', 'signoutdevices', 'resetpassword', 'reset-password']) ||
    extractDigits(body, 6),
  max: (body) =>
    findLink(body, ['set-new-password', 'reset-password', 'changepassword']) || extractDigits(body, 6),
  vix: (body) => {
    const match = body.match(/(?:Cambia tu contrase[ñn]a|Restablecer|Reset)[\s\S]{0,4000}?<a[^>]*href="([^"]+)"/i);
    if (match) return { type: 'link', value: match[1] };
    const linkMatch = body.match(/<a[^>]*href="([^"]*(?:click|link|auth|reset|password|recuperar)[^"]*)"/i);
    if (linkMatch) return { type: 'link', value: linkMatch[1] };
    return null;
  }
};

export function extractResult(body, platform) {
  if (!body || typeof body !== 'string') {
    return { type: 'code', value: '—' };
  }
  const extractor = platformExtractors[platform?.toLowerCase()];
  if (extractor) {
    const extracted = extractor(body);
    if (extracted) return extracted;
  }
  const digit6 = extractDigits(body, 6);
  if (digit6) return digit6;
  const digit4 = extractDigits(body, 4);
  if (digit4) return digit4;

  return { type: 'html', value: body };
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método no permitido. Use POST.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // Ignorar si ya era objeto
    }
  }

  const { email, botCode, type, server } = body || {};

  // 1. Validación de campos obligatorios
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({
      success: false,
      error: 'El campo de correo electrónico es obligatorio.'
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({
      success: false,
      error: 'El correo electrónico ingresado no tiene un formato válido.'
    });
  }

  if (!botCode || typeof botCode !== 'string' || !botCode.trim()) {
    return res.status(400).json({
      success: false,
      error: 'El código BOT es obligatorio.'
    });
  }

  if (!type || typeof type !== 'string' || !type.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Debes seleccionar una plataforma o servicio.'
    });
  }

  const cleanServer = (server && typeof server === 'string' && server.trim()) || 'server1';
  const cleanEmail = email.trim();
  const cleanBotCode = botCode.trim();
  const cleanType = type.trim().toLowerCase();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let targetUrl = PROVIDER_ENDPOINT_URL;
    let fetchOptions = {
      method: PROVIDER_METHOD,
      headers: { ...PROVIDER_HEADERS },
      signal: controller.signal
    };

    if (PROVIDER_METHOD === 'GET') {
      const queryParams = new URLSearchParams({
        email: cleanEmail,
        server: cleanServer,
        type: cleanType,
        botCode: cleanBotCode
      });
      const separator = targetUrl.includes('?') ? '&' : '?';
      targetUrl = `${targetUrl}${separator}${queryParams.toString()}`;
    } else {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify({
        email: cleanEmail,
        server: cleanServer,
        type: cleanType,
        botCode: cleanBotCode
      });
    }

    const response = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    let responseData;
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const rawText = await response.text();
      try {
        responseData = JSON.parse(rawText);
      } catch {
        responseData = { message: rawText };
      }
    }

    if (!response.ok) {
      let errorMessage = 'No fue posible completar la consulta con el proveedor.';
      if (Array.isArray(responseData?.errors) && responseData.errors[0]?.message) {
        errorMessage = responseData.errors[0].message;
      } else if (responseData?.error) {
        errorMessage = typeof responseData.error === 'string' ? responseData.error : JSON.stringify(responseData.error);
      } else if (responseData?.message) {
        errorMessage = responseData.message;
      } else if (response.status === 404) {
        errorMessage = 'El recurso o código solicitado no fue encontrado en el proveedor.';
      } else if (response.status === 502 || response.status === 503) {
        errorMessage = 'El servidor proveedor se encuentra temporalmente no disponible.';
      }

      return res.status(response.status >= 500 ? 502 : 400).json({
        success: false,
        error: errorMessage
      });
    }

    const emailBody = responseData?.body || (typeof responseData === 'string' ? responseData : '');
    const extracted = extractResult(emailBody, cleanType);

    const resultPayload = {
      extracted: extracted,
      subject: responseData?.subject || 'Código de Verificación',
      date: responseData?.date || new Date().toISOString(),
      platform: cleanType,
      server: cleanServer,
      email: cleanEmail,
      raw: responseData
    };

    return res.status(200).json({
      success: true,
      data: resultPayload
    });

  } catch (err) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        error: 'El servidor del proveedor tardó demasiado tiempo en responder (Timeout).'
      });
    }

    return res.status(502).json({
      success: false,
      error: 'Error de comunicación al conectar con el servicio externo.'
    });
  }
}
