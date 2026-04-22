import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ChatService } from 'src/app/services/chat.service';

interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
}

@Component({
  selector: 'app-chatbot',
  templateUrl: './chatbot.page.html',
  styleUrls: ['./chatbot.page.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule]
})
export class ChatbotPage {

  newMessage: string = '';
  messages: ChatMessage[] = [
    { role: 'bot', text: 'Hola, soy el asistente de NEXO. ¿En qué puedo ayudarte?' }
  ];
  loading: boolean = false;

  constructor(private chatService: ChatService) {}

  sendMessage() {
    const text = this.newMessage.trim();

    if (!text || this.loading) return;

    this.messages.push({ role: 'user', text });
    this.newMessage = '';
    this.loading = true;

    this.chatService.sendMessage(text).subscribe({
      next: (response) => {
        this.messages.push({
          role: 'bot',
          text: response.reply
        });
        this.loading = false;
      },
      error: (error) => {
        console.error('Error:', error);
        this.messages.push({
          role: 'bot',
          text: 'Error al conectar con el servidor.'
        });
        this.loading = false;
      }
    });
  }
}