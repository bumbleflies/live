import { useCallback, useState } from 'react';

export function LinkRow({ label, link }: { label: string; link: string }) {
  return (
    <div className="link-row">
      <span className="link-label">{label}</span>
      <a className="link-value" href={link} target="_blank" rel="noreferrer">
        {link}
      </a>
      <CopyBtn text={link} />
    </div>
  );
}

export function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);
  return (
    <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={copy}>
      {copied ? 'copied' : label ?? 'copy'}
    </button>
  );
}
