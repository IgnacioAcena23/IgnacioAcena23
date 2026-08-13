const fs = require('fs');

const GH_TOKEN = process.env.GH_TOKEN;
const USERNAME = process.env.GITHUB_REPOSITORY_OWNER || 'tu-usuario';

async function fetchStats() {
  const query = `
    query {
      user(login: "${USERNAME}") {
        repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
          nodes {
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
              edges {
                size
                node { name color }
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `bearer ${GH_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Node.js'
    },
    body: JSON.stringify({ query }),
  });

  const json = await response.json();

  if (!json.data || !json.data.user) {
    console.error('Error al obtener datos de la API de GraphQL:', json);
    process.exit(1);
  }

  const repos = json.data.user.repositories.nodes;
  const stats = {};
  let totalBytes = 0;

  repos.forEach(repo => {
    repo.languages.edges.forEach(edge => {
      const { name, color } = edge.node;
      const size = edge.size;
      if (name === 'Jupyter Notebook') return;
      totalBytes += size;

      if (!stats[name]) {
        stats[name] = { bytes: 0, color: color || '#858585' };
      }
      stats[name].bytes += size;
    });
  });

  const sorted = Object.entries(stats)
    .sort((a, b) => b[1].bytes - a[1].bytes)
    .slice(0, 5);

  return generateSVG(sorted, totalBytes);
}

function generateSVG(languages, totalBytes) {
  const maxBarWidth = 300; // Ancho máximo de la barra en píxeles
  let yOffset = 55;

  // Generar reglas de animación CSS individuales para cada barra
  const keyframesStyle = languages.map(([_, data], index) => {
    const percentage = totalBytes > 0 ? (data.bytes / totalBytes) * 100 : 0;
    const barWidth = Math.max((percentage / 100) * maxBarWidth, 4);
    
    return `
      @keyframes fillBar${index} {
        from { width: 0px; }
        to { width: ${barWidth.toFixed(1)}px; }
      }
      .bar-${index} {
        animation: fillBar${index} 1.2s cubic-bezier(0.25, 1, 0.5, 1) forwards;
      }
    `;
  }).join('\n');

  const itemsSvg = languages.map(([lang, data], index) => {
    const percentage = totalBytes > 0 ? ((data.bytes / totalBytes) * 100).toFixed(1) : '0';

    const item = `
      <g class="lang-row" transform="translate(25, ${yOffset})">
        <circle cx="6" cy="-4" r="5" fill="${data.color}" />
        <text x="20" y="0" class="lang-name">${lang}</text>
        <text x="300" y="0" class="lang-pct">${percentage}%</text>
        
        <!-- Pista de fondo de la barra -->
        <rect x="0" y="8" width="${maxBarWidth}" height="7" rx="3.5" fill="#21262d" />
        
        <!-- Barra de progreso animada -->
        <rect class="bar bar-${index}" x="0" y="8" height="7" rx="3.5" fill="${data.color}" />
      </g>
    `;
    yOffset += 45;
    return item;
  }).join('');

  return `<svg width="350" height="${yOffset + 10}" viewBox="0 0 350 ${yOffset + 10}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .card-bg { fill: #0d1117; stroke: #30363d; stroke-width: 1px; rx: 12px; }
    .header-title { fill: #58a6ff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; font-weight: 600; }
    .lang-name { fill: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; font-weight: 500; }
    .lang-pct { fill: #8b949e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 12px; text-anchor: end; font-weight: 500; }
    
    .lang-row { transition: transform 0.2s ease; }
    .lang-row:hover .bar { filter: brightness(1.3); }
    .lang-row:hover .lang-name { fill: #58a6ff; }
    
    ${keyframesStyle}
  </style>

  <rect width="100%" height="100%" class="card-bg" />
  <text x="25" y="30" class="header-title">Lenguajes más usados</text>
  ${itemsSvg}
</svg>`;
}

fetchStats().then(svg => {
  fs.writeFileSync('languages.svg', svg);
  console.log('SVG generado exitosamente como languages.svg');
}).catch(err => {
  console.error('Error generando el SVG:', err);
  process.exit(1);
});
