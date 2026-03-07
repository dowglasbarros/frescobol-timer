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
  theme = signal<'default' | 'solar' | 'night'>('default');

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

  setTheme(newTheme: 'default' | 'solar' | 'night') {
    this.theme.set(newTheme);

    // Opcional: Salvar preferência no LocalStorage para o PWA lembrar depois
    localStorage.setItem('fresco-theme', newTheme);
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
