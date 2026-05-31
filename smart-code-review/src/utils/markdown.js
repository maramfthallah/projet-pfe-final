export function escHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatMarkdown(text) {
  if (typeof text !== 'string' || !text.trim()) return '';

  return text
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="ml__code-block"><span class="ml__code-lang">${lang || 'code'}</span><code>${escHtml(code.trim())}</code></pre>`,
    )
    .replace(/`([^`]+)`/g, '<code class="ml__code-inline">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 class="ml__h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="ml__h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="ml__h1">$1</h1>')
    .replace(/^\s*[-*] (.+)$/gm, '<li class="ml__li">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>\n?)+/g, s => `<ul class="ml__ul">${s}</ul>`)
    .replace(/\n{2,}/g, '</p><p class="ml__p">')
    .replace(/\n/g, '<br/>');
}

export function formatTime(seconds) {
  const mins = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}