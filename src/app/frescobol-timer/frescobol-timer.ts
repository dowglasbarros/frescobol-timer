import { Component, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-frescobol-timer',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './frescobol-timer.html',
  styleUrls: ['./frescobol-timer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FrescobolTimer implements OnInit {
  distancia = signal<number>(8);
  lastTapTime = signal<number | null>(null);

  // Histórico de velocidades em m/s
  historico = signal<number[]>([]);

  // Velocidade da última batida (convertida)
  velocidadeAtualKmH = computed(() => {
    const lista = this.historico();
    if (lista.length === 0) return '0.0';
    return (lista[lista.length - 1] * 3.6).toFixed(1);
  });

  // Média das velocidades da sessão
  mediaVelocidadeKmH = computed(() => {
    const lista = this.historico();
    if (lista.length === 0) return '0.0';
    const soma = lista.reduce((acc, val) => acc + val, 0);
    return ((soma / lista.length) * 3.6).toFixed(1);
  });

  ngOnInit(): void {
    this.manterTelaAtiva();
  }

  async manterTelaAtiva() {
    if ('wakeLock' in navigator) {
      try {
        const wakeLock = await (navigator as any).wakeLock.request('screen');
        console.log('Tela permanecerá ativa durante o jogo.');
      } catch (err) {
        console.error('Erro ao solicitar Wake Lock:', err);
      }
    }
  }

  registrarToque() {
    const agora = performance.now();
    const anterior = this.lastTapTime();

    if (anterior) {
      const deltaS = (agora - anterior) / 1000;

      // Validação: Ignora toques acidentais (mais de 120km/h ou menos de 0.2s)
      if (deltaS > 0.2) {
        const v = this.distancia() / deltaS;
        // Atualiza o array de forma imutável (padrão Signals)
        this.historico.update((h) => [...h, v].slice(-10)); // Mantém as últimas 10
      }
    }
    this.lastTapTime.set(agora);
  }

  reset() {
    this.historico.set([]);
    this.lastTapTime.set(null);
  }
}
