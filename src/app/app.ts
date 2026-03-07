import { Component, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { FrescobolTimer } from './frescobol-timer/frescobol-timer';

@Component({
  selector: 'app-root',
  imports: [FrescobolTimer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private swUpdate = inject(SwUpdate);

  constructor() {
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.subscribe((evt) => {
        if (evt.type === 'VERSION_READY') {
          if (confirm('Nova versão disponível! Deseja atualizar agora?')) {
            window.location.reload();
          }
        }
      });
    }
  }
}
