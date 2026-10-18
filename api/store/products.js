// Vercel Serverless Function: GET /api/store/products
// Proxy para consultar categorías del catálogo

export const config = {
  maxDuration: 15
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const catUrl = 'https://api.starlatinotv.org/api/category/';
    const response = await fetch(catUrl, {
      headers: {
        'X-Tenant-ID': process.env.PROVIDER_TENANT_ID || 'samuelinho',
        'Origin': process.env.PROVIDER_ORIGIN || 'https://samuelinho.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return res.status(200).json({
        success: true,
        categories: data.categories || []
      });
    }

    return res.status(200).json({
      success: false,
      error: 'No se pudo consultar el catálogo externo',
      categories: []
    });
  } catch (err) {
    return res.status(200).json({
      success: false,
      error: err.message,
      categories: []
    });
  }
}
