// A tiny element builder, so the modes can describe their controls declaratively:
// h('button', { class: 'btn', onClick: fn }, 'Text').

export function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  return append(node, ...children);
}

// Node.append with h()'s rules for children, so `cond && h(...)` can be passed directly:
// the native append would print a false or null as text.
export function append(parent, ...children) {
  parent.append(...children.flat(Infinity).filter((c) => c != null && c !== false && c !== ''));
  return parent;
}

// True while a modal dialog is open, so the modes' keyboard shortcuts stand down.
export function dialogOpen() {
  return document.querySelector('dialog[open]') !== null;
}

// Whether a key event should be left to the browser (shortcuts with modifiers, typing in a field).
export function ignoreKey(event) {
  return event.ctrlKey || event.metaKey || event.altKey || dialogOpen()
    || event.target.closest?.('input, select, textarea');
}
