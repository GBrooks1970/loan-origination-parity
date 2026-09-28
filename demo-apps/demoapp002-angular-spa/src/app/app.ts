import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
    selector: 'lop-root',
    imports: [RouterOutlet, RouterLink],
    template: `
        <header class="banner">
            <p class="brand">Loan origination workbench</p>
            <nav aria-label="Main">
                <a routerLink="/applications">Applications</a>
            </nav>
        </header>
        <main id="main">
            <router-outlet />
        </main>
    `,
})
export class App {}
