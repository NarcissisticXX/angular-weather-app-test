import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http'; // HttpClient e HttpErrorResponse importati


export interface OpenWeatherResponse {
  name: string;
  main: {
    temp: number;
    humidity?: number; // Opzionale, potremmo aggiungerlo dopo
    pressure?: number; // Opzionale
  };
  weather: [ // È un array, ma ci interessa solo il primo elemento
    {
      description: string;
      icon: string;
      main?: string; // Es. "Clouds", "Rain"
      id?: number;   // Es. 801
    }
  ];
  wind?: { // Opzionale
    speed: number;
  };
  sys?: { // Opzionale
    country: string;
  };
}


@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [
    FormsModule, CommonModule
  ],
  templateUrl: './weather.component.html',
  styleUrl: './weather.component.css'
})



export class WeatherComponent {
  cittaDaMostrare: string = 'Nessuna città selezionata';
  temperaturaCorrente: number | null = 0;
  condizioniMeteo: string = 'N/D';
  iconaMeteoUrl: string = '';
  isLoading: boolean = false; // Per un futuro indicatore di caricamento
  inputCittaValue: string = 'Catanzaro'; // Valore iniziale per l'input
  errorMessage: string | null = null; // Per mostrare errori API

  private apiKey = "60b6d82c1b00be1baff996064cf61a70"; 
  private apiUrlBase = "https://api.openweathermap.org/data/2.5/weather";

  // Inietta HttpClient
  constructor(private http: HttpClient) {}

handleSearch() {
    if (!this.inputCittaValue.trim()) {
      this.errorMessage = "Per favore, inserisci il nome di una città.";
      return;
    }
    this.isLoading = true;
    this.errorMessage = null; // Resetta errori precedenti
    this.cittaDaMostrare = ''; // Resetta i dati precedenti
    this.temperaturaCorrente = null;
    this.condizioniMeteo = '';
    this.iconaMeteoUrl = '';

    const apiUrl = `${this.apiUrlBase}?q=${this.inputCittaValue}&appid=${this.apiKey}&units=metric&lang=it`;
    // units=metric per avere la temperatura in Celsius
    // lang=it per avere la descrizione in italiano (se supportato dall'API per quella descrizione)

    this.http.get<OpenWeatherResponse>(apiUrl).subscribe({
      next: (data: OpenWeatherResponse) => {
        // Successo!
        this.cittaDaMostrare = data.name;
        this.temperaturaCorrente = Math.round(data.main.temp); // Arrotonda la temperatura
        if (data.weather && data.weather.length > 0) {
          this.condizioniMeteo = data.weather[0].description;
          const iconCode = data.weather[0].icon;
          this.iconaMeteoUrl = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
        } else {
          this.condizioniMeteo = 'Non disponibile';
        }
        this.isLoading = false;
        this.inputCittaValue = '';
      },
      error: (error: HttpErrorResponse | any) => {
        // Errore!
        console.error('Errore durante la chiamata API:', error);
        if (error.status === 404) {
          this.errorMessage = `Città "${this.inputCittaValue}" non trovata.`;
        } else if (error.status === 401) {
          this.errorMessage = "Errore di autenticazione. Controlla la tua API key.";
        }
        else {
          this.errorMessage = "Si è verificato un errore nel recuperare i dati meteo.";
        }
        this.isLoading = false;
      }
    })
  }
}
