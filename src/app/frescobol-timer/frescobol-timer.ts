import { Component, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-frescobol-timer',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './frescobol-timer.html',
  styleUrls: ['./frescobol-timer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FrescobolTimer {
  // Signals para estado reativo
  distancia = signal<number>(8); // Distância padrão em metros
  lastTapTime = signal<number | null>(null);
  velocidadeAtual = signal<number>(0);

  // Computed signal para formatar a exibição
  velocidadeKmH = computed(() => {
    const ms = this.velocidadeAtual();
    return (ms * 3.6).toFixed(1); // Converte m/s para km/h
  });

  registrarToque(lado: 'esquerda' | 'direita') {
    const agora = performance.now(); // Precisão de microssegundos
    const tempoAnterior = this.lastTapTime();

    if (tempoAnterior) {
      const deltaTempoS = (agora - tempoAnterior) / 1000;
      if (deltaTempoS > 0.1) {
        // Debounce simples para evitar toques fantasmas
        const velocidade = this.distancia() / deltaTempoS;
        this.velocidadeAtual.set(velocidade);
      }
    }

    this.lastTapTime.set(agora);
  }

  reset() {
    this.velocidadeAtual.set(0);
    this.lastTapTime.set(null);
  }
}
