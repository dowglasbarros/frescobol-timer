import { CommonModule } from '@angular/common';
import { Component, signal, computed, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-frescobol-timer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './frescobol-timer.html',
  styleUrls: ['./frescobol-timer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FrescobolTimer implements OnInit {
  // Configurações e Estado
  private audioCtx: AudioContext | null = null;
  distancia = signal<number>(8);
  tempoRestante = signal<number>(300); // 5 minutos
  timerAtivo = signal<boolean>(false);
  quedas = signal<number>(0); // Limite de 20 quedas
  lastTapTime = signal<number | null>(null);
  intervalId: any;

  // Jogadores
  jogador1 = signal<string>('Atleta A');
  jogador2 = signal<string>('Atleta B');
  editandoJ1 = signal<boolean>(false);
  editandoJ2 = signal<boolean>(false);

  // Histórico de pontos (Baseado na fórmula: vel² / 50)
  pontosJ1 = signal<number[]>([]);
  pontosJ2 = signal<number[]>([]);

  // Velocidades atuais em km/h
  velAtualJ1 = signal<number>(0);
  velAtualJ2 = signal<number>(0);

  // Formatação do Tempo (Minutos:Segundos)
  cronometroFormatado = computed(() => {
    const min = Math.floor(this.tempoRestante() / 60);
    const seg = this.tempoRestante() % 60;
    return `${min}:${seg.toString().padStart(2, '0')}`;
  });

  // GOLPES: Soma dos 150 golpes mais fortes de cada atleta
  totalBrutoJ1 = computed(() => this.calcularTop150(this.pontosJ1()));
  totalBrutoJ2 = computed(() => this.calcularTop150(this.pontosJ2()));

  // EQUILÍBRIO: Diferença de pontuação limitada a 30%
  pontosEquilibrados = computed(() => {
    let p1 = this.totalBrutoJ1();
    let p2 = this.totalBrutoJ2();

    if (p1 > 0 && p2 > 0) {
      p1 = Math.min(p1, p2 * 1.3);
      p2 = Math.min(p2, p1 * 1.3);
    }
    return {
      j1: Math.round(p1),
      j2: Math.round(p2),
      total: p1 + p2,
    };
  });

  // QUEDAS: Primeiras 5 sem penalidades. Da 6ª em diante, -3% por queda
  percentualPenalidade = computed(() => {
    const q = this.quedas();
    return q > 5 ? (q - 5) * 0.03 : 0;
  });

  // Pontuação Final do Time
  pontuacaoFinal = computed(() => {
    const total = this.pontosEquilibrados().total;
    const penalidade = total * this.percentualPenalidade();
    return Math.round(total - penalidade);
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

  executarFeedbacks() {
    // 1. VIBRAÇÃO (20ms é o "clique" ideal para simular o impacto da bola)
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }

    // 2. SOM (Oscilador de alta precisão para evitar delay de arquivos MP3)
    this.tocarBip(600, 0.05); // Som agudo e curto para a batida
  }

  tocarBip(frequencia: number, duracao: number) {
    try {
      if (!this.audioCtx)
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequencia, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duracao);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duracao);
    } catch (e) {
      console.warn('Áudio não suportado ou bloqueado pelo navegador.');
    }
  }

  registrarBatida(id: 1 | 2) {
    const agora = performance.now();
    const anterior = this.lastTapTime();

    if (!this.timerAtivo() && this.tempoRestante() > 0) this.toggleTimer();

    if (anterior) {
      const deltaS = (agora - anterior) / 1000;
      // Impede toque duplo acidental (delay mínimo de 150ms)
      if (deltaS > 0.15) {
        const velKmh = (this.distancia() / deltaS) * 3.6;

        // Aplicação da Tabela FrescoGO!: Golpe = vel² / 50
        const pontosDoGolpe = Math.pow(velKmh, 2) / 50;

        if (id === 1) {
          // Se o J1 rebateu, a bola veio do J2. O J2 que bateu forte!
          this.pontosJ2.update((h) => [...h, pontosDoGolpe]);
          this.velAtualJ2.set(velKmh);
        } else {
          // Se o J2 rebateu, a bola veio do J1. O J1 que bateu forte!
          this.pontosJ1.update((h) => [...h, pontosDoGolpe]);
          this.velAtualJ1.set(velKmh);
        }

        if ('vibrate' in navigator) navigator.vibrate(20);
      }
    }

    this.executarFeedbacks();
    this.lastTapTime.set(agora);
  }

  registrarQueda() {
    this.quedas.update((q) => q + 1);
    this.lastTapTime.set(null); // Reseta o delay para a próxima batida

    if (this.quedas() >= 20) {
      this.finalizarPartida('20 Quedas alcançadas. Jogo sumariamente interrompido!');
    }
  }

  // Função utilitária para pegar apenas os 150 maiores valores
  private calcularTop150(pontos: number[]): number {
    return [...pontos]
      .sort((a, b) => b - a)
      .slice(0, 150)
      .reduce((soma, valor) => soma + valor, 0);
  }

  toggleTimer() {
    if (this.timerAtivo()) {
      clearInterval(this.intervalId);
    } else {
      this.intervalId = setInterval(() => {
        this.tempoRestante.update((t) => (t > 0 ? t - 1 : 0));
        if (this.tempoRestante() === 0) this.finalizarPartida('Fim dos 5 Minutos!');
      }, 1000);
    }
    this.timerAtivo.update((v) => !v);
  }

  resetTudo() {
    this.resetTimer();
    this.pontosJ1.set([]);
    this.pontosJ2.set([]);
    this.velAtualJ1.set(0);
    this.velAtualJ2.set(0);
    this.quedas.set(0);
    this.lastTapTime.set(null);
  }

  private resetTimer() {
    clearInterval(this.intervalId);
    this.timerAtivo.set(false);
    this.tempoRestante.set(300);
  }

  finalizarPartida(motivo: string) {
    this.resetTimer();
    alert(`${motivo}\nPontuação Final do Time: ${this.pontuacaoFinal()}`);
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
  }
}
