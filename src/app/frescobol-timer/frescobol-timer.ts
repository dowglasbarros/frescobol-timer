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
  imports: [FormsModule],
  templateUrl: './frescobol-timer.html',
  styleUrls: ['./frescobol-timer.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FrescobolTimer implements OnInit {
  private audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  distancia = signal<number>(8);
  isSoundEnabled = signal<boolean>(true);
  lastTapTime = signal<number | null>(null);
  theme = signal<'default' | 'solar' | 'night'>('default');

  // Signal para armazenar o evento de instalação (DeferredPrompt)
  deferredPrompt = signal<any>(null);
  showInstallModal = signal<boolean>(false);

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

  @HostListener('window:beforeinstallprompt', ['$event'])
  onBeforeInstallPrompt(e: Event) {
    // Impede que o navegador mostre o banner padrão automaticamente
    e.preventDefault();
    // Guarda o evento para disparar depois
    this.deferredPrompt.set(e);
    // Mostra nossa modal customizada
    this.showInstallModal.set(true);
  }

  ngOnInit(): void {
    this.manterTelaAtiva();
    const saved = localStorage.getItem('fresco-theme') as any;
    if (saved) this.theme.set(saved);
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

  ajustarDistancia(valor: number) {
    this.distancia.update((d) => {
      const novaDist = d + valor;
      // Limite mínimo de 1m e máximo de 30m para evitar erros de cálculo
      return novaDist >= 1 ? novaDist : 1;
    });

    // Feedback tátil ao ajustar
    if ('vibrate' in navigator) navigator.vibrate(10);
  }

  fecharModal() {
    this.showInstallModal.set(false);
  }

  tocarBip(frequencia = 880, duracao = 0.1) {
    const oscillator = this.audioCtx.createOscillator();
    const gainNode = this.audioCtx.createGain();

    oscillator.type = 'sine'; // Som limpo
    oscillator.frequency.setValueAtTime(frequencia, this.audioCtx.currentTime);

    // Envelope de volume para evitar estalos (cliques) no som
    gainNode.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duracao);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioCtx.destination);

    oscillator.start();
    oscillator.stop(this.audioCtx.currentTime + duracao);
  }

  registrarToque() {
    const agora = performance.now();
    const anterior = this.lastTapTime();

    if (this.isSoundEnabled()) {
      this.tocarBip(); // Chamada do som
    }

    this.vibrar(20); // 20ms de vibração curta e seca

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

  setTheme(newTheme: 'default' | 'solar' | 'night') {
    this.theme.set(newTheme);

    // Opcional: Salvar preferência no LocalStorage para o PWA lembrar depois
    localStorage.setItem('fresco-theme', newTheme);
  }

  toggleSound() {
    this.isSoundEnabled.update((v) => !v);
    // No iOS, o AudioContext precisa ser resumido após um gesto do usuário
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }
  private vibrar(ms: number) {
    // Verifica se o navegador suporta a API e se não está em modo mudo
    if ('vibrate' in navigator && this.isSoundEnabled()) {
      navigator.vibrate(ms);
    }
  }

  exportarDados() {
    const dados = this.historico();
    if (dados.length === 0) return;

    // Cabeçalho e Linhas do CSV
    const csvContent = [
      ['Batida', 'Velocidade (m/s)', 'Velocidade (km/h)'],
      ...dados.map((v, i) => [i + 1, v.toFixed(2), (v * 3.6).toFixed(1)]),
    ]
      .map((e) => e.join(','))
      .join('\n');

    // Criação do Blob (Binary Large Object)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Link temporário para disparo do download
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `sessao_frescobol_${new Date().getTime()}.csv`);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Limpeza de memória
    URL.revokeObjectURL(url);
  }
}
