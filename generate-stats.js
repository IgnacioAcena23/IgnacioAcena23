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
  let yOffset = 45;

  const itemsSvg = languages.map(([lang, data]) => {
    const percentage = totalBytes > 0 ? ((data.bytes / totalBytes) * 100).toFixed(1) : '0';
    const item = `
      <g transform="translate(20, ${yOffset})">
        <circle cx="8" cy="-5" r="6" fill="${data.color}" />
        <text x="22" y="0" fill="#c9d1d9" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" font-size="13">${lang}</text>
        <text x="260" y="0" fill="#8b949e" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" font-size="13" text-anchor="end">${percentage}%</text>
      </g>
    `;
    yOffset += 28;
    return item;
  }).join('');

  return `<svg width="300" height="${yOffset + 15}" viewBox="0 0 300 ${yOffset + 15}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" rx="10" fill="#0d1117" stroke="#30363d" stroke-width="1"/>
  <text x="20" y="25" fill="#58a6ff" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" font-size="15" font-weight="600">Lenguajes más usados</text>
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
