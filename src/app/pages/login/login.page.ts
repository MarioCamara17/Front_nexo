import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ReactiveFormsModule
} from '@angular/forms';
import {
  AlertController,
  ToastController,
  IonicModule
} from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../services/auth/auth.service';
import { Login } from '../../models/login.model';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule
  ]
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  showPassword = false;
  isLoading = false;

  private emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  constructor(
    private formBuilder: FormBuilder,
    private alertController: AlertController,
    private toastController: ToastController,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [
        Validators.required,
        Validators.email,
        Validators.pattern(this.emailPattern)
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(8)
      ]],
      rememberMe: [false]
    });
  }

  get email(): AbstractControl | null {
    return this.loginForm.get('email');
  }

  get password(): AbstractControl | null {
    return this.loginForm.get('password');
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  async onSubmit(): Promise<void> {
    if (!this.loginForm.valid) {
      await this.showValidationErrors();
      return;
    }

    if (this.isLoading) {
      return;
    }

    this.isLoading = true;

    const credentials: Login = {
      email: this.loginForm.value.email,
      password: this.loginForm.value.password
    };

    console.log('Intentando iniciar sesión con:', credentials.email);

    this.authService.login(credentials)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: async (response) => {
          console.log('Login exitoso:', response);

          await this.showSuccessToast('¡Inicio de sesión exitoso!');

          this.router.navigate(['/tabs/home']);
        },
        error: async (error) => {
          console.error('Error en login:', error);

          let errorMsg = 'Credenciales inválidas. Por favor intenta de nuevo.';

          if (error.status === 0) {
            errorMsg = 'No se pudo conectar al servidor. Verifica tu conexión a internet.';
          } else if (error.error) {
            if (error.error.non_field_errors) {
              errorMsg = error.error.non_field_errors[0];
            } else if (error.error.detail) {
              errorMsg = error.error.detail;
            } else if (error.error.message) {
              errorMsg = error.error.message;
            }
          } else if (error.message) {
            errorMsg = error.message;
          }

          await this.showErrorAlert('Error de autenticación', errorMsg);
        }
      });
  }

  private async showValidationErrors(): Promise<void> {
    const errors: string[] = [];

    if (this.email?.errors) {
      if (this.email.errors['required']) {
        errors.push('El correo electrónico es requerido');
      }

      if (this.email.errors['email'] || this.email.errors['pattern']) {
        errors.push('El formato del correo no es válido');
      }
    }

    if (this.password?.errors) {
      if (this.password.errors['required']) {
        errors.push('La contraseña es requerida');
      }

      if (this.password.errors['minlength']) {
        errors.push('La contraseña debe tener al menos 8 caracteres');
      }
    }

    if (errors.length > 0) {
      const alert = await this.alertController.create({
        header: 'Errores de validación',
        message: errors.join('<br>'),
        buttons: ['OK']
      });

      await alert.present();
    }
  }

  private async showSuccessToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color: 'success',
      position: 'top'
    });

    await toast.present();
  }

  private async showErrorAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });

    await alert.present();
  }
}