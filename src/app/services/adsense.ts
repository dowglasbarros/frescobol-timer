import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class AdsenseService {
  private scriptCarregado = false;

  constructor(@Inject(DOCUMENT) private document: Document) {}

  carregarScript(publisherId: string): void {
    if (this.scriptCarregado) return;

    const script = this.document.createElement('script');
    script.src = `https://googlesyndication.com{publisherId}`;
    script.async = true;
    script.crossOrigin = 'anonymous';

    this.document.head.appendChild(script);
    this.scriptCarregado = true;
  }
}
