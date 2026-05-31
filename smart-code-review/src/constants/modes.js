/* File extension ? language name (for display and syntax context) */
export const EXT_TO_LANG = {
  js:    'JavaScript',
  jsx:   'JavaScript',
  ts:    'TypeScript',
  tsx:   'TypeScript',
  py:    'Python',
  java:  'Java',
  cs:    'C#',
  cpp:   'C++',
  cc:    'C++',
  cxx:   'C++',
  h:     'C/C++',
  go:    'Go',
  rs:    'Rust',
  php:   'PHP',
  rb:    'Ruby',
  html:  'HTML',
  css:   'CSS',
  scss:  'SCSS',
  json:  'JSON',
  md:    'Markdown',
  yaml:  'YAML',
  yml:   'YAML',
  xml:   'XML',
  sql:   'SQL',
  sh:    'Shell',
  bash:  'Shell',
  dockerfile: 'Dockerfile',
  txt:   'Text',
};

/* File extension ? Material Symbols icon name */
export const EXT_TO_ICON = {
  js:    'javascript',
  jsx:   'javascript',
  ts:    'code',
  tsx:   'code',
  py:    'code',
  java:  'coffee',
  cs:    'code',
  cpp:   'memory',
  go:    'code',
  rs:    'code',
  php:   'code',
  rb:    'diamond',
  html:  'html',
  css:   'css',
  scss:  'css',
  json:  'data_object',
  md:    'description',
  yaml:  'settings',
  yml:   'settings',
  xml:   'code',
  sql:   'database',
  sh:    'terminal',
  bash:  'terminal',
  txt:   'article',
  svg:   'image',
  png:   'image',
  jpg:   'image',
  gif:   'image',
};

/* File extension ? color for the icon */
export const EXT_TO_COLOR = {
  js:    '#f7df1e',
  jsx:   '#61dafb',
  ts:    '#3178c6',
  tsx:   '#3178c6',
  py:    '#3776ab',
  java:  '#ed8b00',
  cs:    '#68217a',
  cpp:   '#00599c',
  go:    '#00add8',
  rs:    '#ce412b',
  php:   '#777bb4',
  rb:    '#cc342d',
  html:  '#e34c26',
  css:   '#1572b6',
  scss:  '#c6538c',
  json:  '#5bb882',
  md:    '#8b949e',
  yaml:  '#cb171e',
  yml:   '#cb171e',
  sql:   '#336791',
};

/* Get language from file path */
export function getLangFromPath(filePath) {
  const ext = filePath?.split('.').pop()?.toLowerCase();
  return EXT_TO_LANG[ext] || 'Text';
}

/* Get icon from file path */
export function getIconFromPath(filePath) {
  const ext = filePath?.split('.').pop()?.toLowerCase();
  return EXT_TO_ICON[ext] || 'description';
}

/* Get icon color from file path */
export function getColorFromPath(filePath) {
  const ext = filePath?.split('.').pop()?.toLowerCase();
  return EXT_TO_COLOR[ext] || '#8b949e';
}

/* Is this a binary/non-text file? */
export function isBinaryFile(filePath) {
  const binaryExts = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'webp',
    'mp3', 'mp4', 'wav', 'ogg', 'pdf', 'zip', 'tar', 'gz',
    'woff', 'woff2', 'ttf', 'eot', 'exe', 'dll', 'so'];
  const ext = filePath?.split('.').pop()?.toLowerCase();
  return binaryExts.includes(ext);
}

export const CODE_FILE_EXTENSIONS = [
  'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cs', 'cpp', 'cc', 'cxx', 'go', 'rs', 'php', 'rb', 'html', 'css', 'scss', 'json', 'md', 'yaml', 'yml', 'sh', 'bash', 'sql', 'txt', 'xml', 'dockerfile', 'svg', 'png', 'jpg', 'jpeg', 'gif'
];

export const ANALYSIS_MODES = [
  { id: 'chat', label: 'Chat', icon: 'chat', desc: 'Posez une question sur votre code.' },
  { id: 'voice', label: 'Voix', icon: 'mic', desc: 'Analyse et dict�e vocale.' },
];

export const MODE_MAP = {
  chat: { id: 'chat', label: 'Chat', icon: 'chat', desc: 'Conversation interactive' },
  voice: { id: 'voice', label: 'Voix', icon: 'mic', desc: 'Commande vocale' },
};
