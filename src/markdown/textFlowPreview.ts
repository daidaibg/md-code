const verticalArrow = /^(?:↓|⇩|⬇|->|=>)$/u;

export function parseVerticalTextFlow(source: string): string[] | null {
  const lines = source.replace(/\r\n?/gu, '\n').split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length < 5 || lines.length % 2 === 0) return null;

  const steps: string[] = [];
  for (const [index, line] of lines.entries()) {
    if (index % 2 === 0) {
      if (verticalArrow.test(line)) return null;
      steps.push(line);
    } else if (!verticalArrow.test(line)) return null;
  }
  return steps.length >= 3 ? steps : null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderVerticalTextFlowHtml(source: string): string | null {
  const steps = parseVerticalTextFlow(source);
  if (!steps) return null;
  return `<div class="md-text-flow">${steps.map((step, index) => [
    `<div class="md-text-flow-step">${escapeHtml(step)}</div>`,
    index < steps.length - 1 ? '<div class="md-text-flow-arrow" aria-hidden="true">↓</div>' : ''
  ].join('')).join('')}</div>`;
}

export function createVerticalTextFlowElement(source: string): HTMLElement | null {
  const html = renderVerticalTextFlowHtml(source);
  if (!html) return null;
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content.firstElementChild as HTMLElement | null;
}
