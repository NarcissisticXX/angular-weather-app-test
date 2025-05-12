// src/app/weather/weather.component.ts

import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms'; // Necessario per [(ngModel)]
import { CommonModule } from '@angular/common'; // Necessario per *ngIf, *ngFor, {{}}, pipe async etc. in componenti standalone
import { HttpClient, HttpErrorResponse } from '@angular/common/http'; // Per chiamate API e gestione errori HTTP
import { environment } from '../../environments/environment'; // Per leggere la API Key

// Definizione dell'Interfaccia per la risposta dell'API OpenWeatherMap
export interface OpenWeatherResponse {
  name: string;
  main: {
    temp: number;
    humidity?: number;
    pressure?: number;
  };
  weather: Array<{ // Uso Array<...> che è equivalente a [{...}] ma a volte più chiaro
    description: string;
    icon: string;
    main?: string;
    id?: number;
  }>;
  wind?: { speed: number; };
  sys?: { country: string; };
}

@Component({
  selector: 'app-weather', // Selettore usato nel template di AppComponent
  standalone: true,      // Marcato come standalone
  imports: [
    CommonModule,         // Importato per direttive come *ngIf, *ngFor
    FormsModule           // Importato per [(ngModel)]
    // NON importare HttpClientModule qui se hai usato provideHttpClient() in app.config o main.ts
  ],
  templateUrl: './weather.component.html',
  styleUrls: ['./weather.component.css'] // Usa styleUrls (plurale) che è più comune, o styleUrl (singolare)
})
export class WeatherComponent implements OnInit { // Implementa OnInit

  // --- Proprietà per UI e Stato Meteo ---
  inputCittaValue: string = ''; // L'utente inserisce la città qui
  cittaDaMostrare: string = ''; // La città visualizzata nei risultati
  temperaturaCorrente: number | null = null; // Temperatura (può essere null)
  condizioniMeteo: string = ''; // Descrizione (es. 'Soleggiato')
  iconaMeteoUrl: string = ''; // URL dell'icona meteo
  isLoading: boolean = false; // Flag per indicatore di caricamento
  errorMessage: string | null = null; // Messaggio di errore da visualizzare

  // --- Proprietà per Funzionalità Preferiti ---
  favoriteCities: string[] = []; // Array che conterrà le città preferite
  isCurrentCityFavorite: boolean = false; // True se la città visualizzata è tra i preferiti
  private readonly favoritesStorageKey = 'angularWeatherAppFavorites'; // Chiave per localStorage

  // --- Proprietà per Configurazione API ---
  private apiUrlBase = "https://api.openweathermap.org/data/2.5/weather"; // URL base API

  // --- Costruttore (UNO SOLO!) ---
  // Inietta il servizio HttpClient per fare chiamate HTTP
  constructor(private http: HttpClient) {}

  // --- Metodo del Ciclo di Vita OnInit ---
  // Eseguito quando il componente viene inizializzato
  ngOnInit(): void {
    this.loadFavorites(); // Carica i preferiti salvati all'avvio
  }

  // --- Metodi per Gestione Preferiti ---

  // Carica le città preferite da localStorage
  private loadFavorites(): void {
    const favoritesJson = localStorage.getItem(this.favoritesStorageKey);
    if (favoritesJson) {
      try {
        this.favoriteCities = JSON.parse(favoritesJson);
      } catch (e) {
        console.error('Errore parsing preferiti localStorage:', e);
        this.favoriteCities = []; // Resetta array in caso di dati corrotti
      }
    } else {
      this.favoriteCities = []; // Inizializza array vuoto se non c'è nulla
    }
    // Aggiorna lo stato del pulsante preferito se una città è già visualizzata
    this.updateFavoriteStatus();
  }

  // Salva l'array corrente dei preferiti nel localStorage
  private saveFavorites(): void {
    try {
      localStorage.setItem(this.favoritesStorageKey, JSON.stringify(this.favoriteCities));
    } catch (e) {
      console.error('Errore salvataggio preferiti localStorage:', e);
    }
  }

  // Controlla se la città attualmente visualizzata è tra i preferiti
  private updateFavoriteStatus(): void {
    if (!this.cittaDaMostrare) { // Se non c'è città visualizzata, non può essere preferita
      this.isCurrentCityFavorite = false;
      return;
    }
    this.isCurrentCityFavorite = this.favoriteCities.includes(this.cittaDaMostrare);
  }

  // Aggiunge o rimuove la città CORRENTEMENTE VISUALIZZATA dai preferiti
  toggleFavorite(): void {
    if (!this.cittaDaMostrare) return; // Non fare nulla se non c'è città

    if (this.isCurrentCityFavorite) { // Se è già preferita, rimuovila
      this.favoriteCities = this.favoriteCities.filter(city => city !== this.cittaDaMostrare);
    } else { // Altrimenti, aggiungila (assicurandosi che non sia già presente per qualche strano motivo)
      if (!this.favoriteCities.includes(this.cittaDaMostrare)) {
        this.favoriteCities.push(this.cittaDaMostrare);
        // this.favoriteCities.sort(); // Opzionale: mantieni la lista ordinata
      }
    }
    this.saveFavorites(); // Salva l'array aggiornato
    this.updateFavoriteStatus(); // Aggiorna lo stato del pulsante/flag
  }

  // Rimuove una città specificata dalla lista dei preferiti (usato dal pulsante 'x' nella lista)
  removeFavorite(cityToRemove: string): void {
    this.favoriteCities = this.favoriteCities.filter(city => city !== cityToRemove);
    this.saveFavorites();
    // Se la città rimossa era quella visualizzata, aggiorna lo stato del pulsante 'toggle'
    if (this.cittaDaMostrare === cityToRemove) {
      this.updateFavoriteStatus();
    }
  }

  // Imposta l'input e avvia la ricerca per una città cliccata dalla lista dei preferiti
  searchFavorite(cityToSearch: string): void {
    this.inputCittaValue = cityToSearch;
    this.handleSearch();
  }

  // --- Metodo Principale per la Ricerca Meteo ---
  handleSearch(): void {
    const cityTrimmed = this.inputCittaValue.trim(); // Pulisci spazi extra
    if (!cityTrimmed) { // Non cercare se l'input è vuoto
      this.errorMessage = "Per favore, inserisci il nome di una città.";
      return;
    }

    // Reset stato UI per nuova ricerca
    this.isLoading = true;
    this.errorMessage = null;
    // Non resettare subito cittaDaMostrare, aspetta la risposta API
    this.temperaturaCorrente = null;
    this.condizioniMeteo = '';
    this.iconaMeteoUrl = '';
    this.isCurrentCityFavorite = false; // Resetta lo stato preferito

    // Leggi API Key dall'ambiente
    const apiKey = environment.openWeatherApiKey;
  

    // Controllo sicurezza API Key
    if (!apiKey) {
         this.errorMessage = "API Key non configurata correttamente.";
         this.isLoading = false;
         console.error("API Key non trovata nel file environment!");
         return;
    }

    // Costruisci URL API
    const apiUrl = `${this.apiUrlBase}?q=${cityTrimmed}&appid=${apiKey}&units=metric&lang=it`;

    // Esegui chiamata HTTP GET
    this.http.get<OpenWeatherResponse>(apiUrl).subscribe({
      // Callback in caso di successo
      next: (data: OpenWeatherResponse) => {
        this.cittaDaMostrare = data.name; // Aggiorna nome città
        this.temperaturaCorrente = Math.round(data.main.temp); // Aggiorna temperatura
        // Estrai descrizione e icona (con controllo)
        if (data.weather && data.weather.length > 0) {
          this.condizioniMeteo = data.weather[0].description;
          const iconCode = data.weather[0].icon;
          this.iconaMeteoUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
        } else {
          this.condizioniMeteo = 'Dati condizioni non disponibili';
        }
        this.isLoading = false; // Fine caricamento
        this.errorMessage = null; // Resetta eventuali errori precedenti
        this.updateFavoriteStatus(); // Controlla se questa nuova città è preferita
        // this.inputCittaValue = ''; // Opzionale: pulisci campo input dopo successo
      },
      // Callback in caso di errore
      error: (error: HttpErrorResponse | any) => {
        console.error('Errore durante la chiamata API:', error);
        this.cittaDaMostrare = ''; // Resetta nome città in caso di errore
        // Gestisci errori comuni
        if (error.status === 404) {
          this.errorMessage = `Città "${cityTrimmed}" non trovata.`;
        } else if (error.status === 401) {
          this.errorMessage = "Errore di autenticazione API. Verifica la API Key.";
        } else { // Errore generico
          this.errorMessage = `Si è verificato un errore (${error.status}): ${error.message}`;
        }
        this.isLoading = false; // Fine caricamento (anche in caso di errore)
      }
    }); // Fine subscribe
  } // Fine handleSearch

} // --- Fine Classe WeatherComponent ---