import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FrescobolTimer } from './frescobol-timer/frescobol-timer';

@Component({
  selector: 'app-root',
  imports: [FrescobolTimer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('frescobol-timer');
}
