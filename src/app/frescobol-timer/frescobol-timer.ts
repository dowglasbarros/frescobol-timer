import { CommonModule } from '@angular/common';
import {
  Component,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
  HostListener,
} from '@angular/core';
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
  // Configurações Base
  distancia = signal<number>(8);
  tempoRestante = signal<number>(300);
  timerAtivo = signal<boolean>(false);
  quedas = signal<number>(0);
  lastTapTime = signal<number | null>(null);
  intervalId: any;
  audioCtx: AudioContext | null = null;
  lastPlayerId = signal<1 | 2 | null>(null);

  // Signal para armazenar o evento de instalação (DeferredPrompt)
  deferredPrompt = signal<any>(null);
  showInstallModal = signal<boolean>(false);

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(e: Event) {
    // Impede que o navegador mostre o banner padrão automaticamente
    e.preventDefault();
    // Guarda o evento para disparar depois
    this.deferredPrompt.set(e);
    // Mostra nossa modal customizada
    this.showInstallModal.set(true);
  }

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

  // 1. CÁLCULO BRUTO (Top 150 golpes)
  totalBrutoJ1 = computed(() => this.calcularTop150(this.pontosJ1()));
  totalBrutoJ2 = computed(() => this.calcularTop150(this.pontosJ2()));

  // 2. REGRA DE EQUILÍBRIO (Teto de 30%)
  // Se J1 tem 1000 e J2 tem 500, o J1 só aproveita 650 (500 * 1.3) para o time.
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

  // 3. PENALIDADE DE QUEDAS
  percentualPenalidade = computed(() => {
    const q = this.quedas();
    return q > 5 ? (q - 5) * 0.03 : 0; // -3% por queda após a 5ª
  });

  pontuacaoFinal = computed(() => {
    const total = this.pontosEquilibrados().total;
    return Math.round(total * (1 - this.percentualPenalidade()));
  });

  cronometroFormatado = computed(() => {
    const min = Math.floor(this.tempoRestante() / 60);
    const seg = this.tempoRestante() % 60;
    return `${min}:${seg.toString().padStart(2, '0')}`;
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

  // REGISTRO DE BATIDA COM INVERSÃO DE LÓGICA
  registrarBatida(idBotaoClicado: 1 | 2) {
    const agora = performance.now();
    const anterior = this.lastTapTime();

    // Trava de tempo esgotado
    if (this.tempoRestante() <= 0) return;

    // Trava de double-tap (só bloqueia se for o mesmo jogador DAQUELE RALLY)
    if (this.lastPlayerId() === idBotaoClicado) return;

    // Auto-inicia se estiver pausado
    if (!this.timerAtivo() && this.tempoRestante() > 0) {
      this.toggleTimer();
    }

    // Se tem um "anterior", significa que a bola estava no ar. Calcula os pontos!
    if (anterior) {
      const deltaS = (agora - anterior) / 1000;
      if (deltaS > 0.15) {
        const velKmh = (this.distancia() / deltaS) * 3.6;

        if (velKmh >= 50) {
          const pts = Math.pow(velKmh, 2) / 50;

          if (idBotaoClicado === 1) {
            this.pontosJ2.update((h) => [...h, pts]);
            this.velAtualJ2.set(velKmh);
          } else {
            this.pontosJ1.update((h) => [...h, pts]);
            this.velAtualJ1.set(velKmh);
          }
        } else {
          if (idBotaoClicado === 1) {
            this.velAtualJ2.set(velKmh);
          } else {
            this.velAtualJ1.set(velKmh);
          }
          console.log('Velocidade abaixo de 50km/h: Não pontuou.');
        }
      }
    }

    // Feedback tátil e sonoro OCORRE SEMPRE (mesmo no saque)
    this.executarFeedbacks();

    // Atualiza a memória de tempo e lado para a PRÓXIMA batida
    this.lastPlayerId.set(idBotaoClicado);
    this.lastTapTime.set(agora);
  }

  registrarQueda() {
    this.quedas.update((q) => q + 1);

    // Zera o tempo e libera qualquer lado para "sacar" a próxima bola
    this.lastTapTime.set(null);
    this.lastPlayerId.set(null);

    if ('vibrate' in navigator) navigator.vibrate([40, 30, 40]);
    if (this.quedas() >= 20) this.finalizarPartida('Limite de quedas!');
  }

  private calcularTop150(pontos: number[]): number {
    return [...pontos]
      .sort((a, b) => b - a)
      .slice(0, 150)
      .reduce((soma, valor) => soma + valor, 0);
  }

  toggleTimer() {
    if (this.timerAtivo()) {
      clearInterval(this.intervalId);
      this.lastTapTime.set(null);
      this.lastPlayerId.set(null);
    } else {
      this.intervalId = setInterval(() => {
        this.tempoRestante.update((t) => (t > 0 ? t - 1 : 0));
        if (this.tempoRestante() === 0) this.finalizarPartida('Fim de Jogo!');
      }, 1000);
    }
    this.timerAtivo.update((v) => !v);
  }

  resetTudo() {
    clearInterval(this.intervalId);
    this.timerAtivo.set(false);
    this.tempoRestante.set(300);
    this.pontosJ1.set([]);
    this.pontosJ2.set([]);
    this.velAtualJ1.set(0);
    this.velAtualJ2.set(0);
    this.quedas.set(0);
    this.lastTapTime.set(null);
    this.lastPlayerId.set(null);
  }

  finalizarPartida(m: string) {
    clearInterval(this.intervalId);
    this.timerAtivo.set(false);
    alert(`${m}\nScore Final: ${this.pontuacaoFinal()}`);
  }

  executarFeedbacks() {
    if ('vibrate' in navigator) navigator.vibrate(20);
    this.tocarBip(600, 0.05);
  }

  tocarBip(f: number, d: number) {
    try {
      if (!this.audioCtx)
        this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.frequency.setValueAtTime(f, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + d);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + d);
    } catch {}
  }

  async instalarPWA() {
    const promptEvent = this.deferredPrompt();
    if (!promptEvent) return;

    // Mostra o prompt nativo
    promptEvent.prompt();

    // Aguarda a escolha do usuário
    const { outcome } = await promptEvent.userChoice;
    console.log(`Usuário escolheu: ${outcome}`);

    // Limpa o evento, pois ele só pode ser usado uma vez
    this.deferredPrompt.set(null);
    this.showInstallModal.set(false);
  }

  fecharModal() {
    this.showInstallModal.set(false);
  }

  ngOnDestroy() {
    clearInterval(this.intervalId);
  }
}
