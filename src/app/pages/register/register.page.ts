import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonicModule,
  AlertController,
  ToastController
} from '@ionic/angular';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../services/auth/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    RouterModule
  ]
})
export class RegisterPage implements OnInit {
  registerForm!: FormGroup;
  showPassword = false;
  isLoading = false;

  private namePattern = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,}$/;
  private emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  // Mínimo 8 caracteres, al menos una letra y un número.
  private passwordPattern = /^(?=.*[a-zA-Z])(?=.*\d).{8,}$/;

  constructor(
    private formBuilder: FormBuilder,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.initializeForm();
  }

  private initializeForm() {
    this.registerForm = this.formBuilder.group(
      {
        firstName: [
          '',
          [
            Validators.required,
            Validators.pattern(this.namePattern)
          ]
        ],
        lastName: [
          '',
          [
            Validators.required,
            Validators.pattern(this.namePattern)
          ]
        ],
        email: [
          '',
          [
            Validators.required,
            Validators.pattern(this.emailPattern)
          ]
        ],
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            Validators.pattern(this.passwordPattern)
          ]
        ],
        confirmPassword: [
          '',
          [
            Validators.required
          ]
        ]
      },
      {
        validators: this.passwordMatchValidator
      }
    );
  }

  private passwordMatchValidator(form: AbstractControl) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');

    if (!password || !confirmPassword) {
      return null;
    }

    if (password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }

    if (confirmPassword.hasError('passwordMismatch')) {
      confirmPassword.setErrors(null);
    }

    return null;
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  async onRegister() {
    if (!this.registerForm.valid) {
      await this.showValidationErrors();
      return;
    }

    if (this.isLoading) {
      return;
    }

    this.isLoading = true;

    const userData = {
      username: this.registerForm.value.email,
      first_name: this.registerForm.value.firstName,
      last_name: this.registerForm.value.lastName,
      email: this.registerForm.value.email,
      password: this.registerForm.value.password
    };

    console.log('Enviando registro:', userData);

    this.authService.register(userData)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        })
      )
      .subscribe({
        next: async (response) => {
          console.log('Registro exitoso:', response);

          await this.showSuccessMessage();

          this.registerForm.reset();

          this.router.navigate(['/login']);
        },
        error: async (error) => {
          console.error('Error completo en registro:', error);

          const errorMessage = this.getRegisterErrorMessage(error);

          await this.showErrorMessage(errorMessage);
        }
      });
  }

  private getRegisterErrorMessage(error: any): string {
    if (!error) {
      return 'Error desconocido al registrar usuario.';
    }

    if (error.status === 0) {
      return 'No se pudo conectar con el servidor. Verifica tu conexión.';
    }

    if (error.error) {
      if (typeof error.error === 'string') {
        return error.error;
      }

      if (error.error.email) {
        return Array.isArray(error.error.email)
          ? error.error.email[0]
          : error.error.email;
      }

      if (error.error.username) {
        return Array.isArray(error.error.username)
          ? error.error.username[0]
          : error.error.username;
      }

      if (error.error.password) {
        return Array.isArray(error.error.password)
          ? error.error.password[0]
          : error.error.password;
      }

      if (error.error.detail) {
        return error.error.detail;
      }

      if (error.error.non_field_errors) {
        return Array.isArray(error.error.non_field_errors)
          ? error.error.non_field_errors[0]
          : error.error.non_field_errors;
      }

      return JSON.stringify(error.error);
    }

    if (error.message) {
      return error.message;
    }

    return 'Error al registrar usuario. Intenta nuevamente.';
  }

  private async showValidationErrors() {
    const errors: string[] = [];

    const firstNameControl = this.registerForm.get('firstName');

    if (firstNameControl?.errors) {
      if (firstNameControl.errors['required']) {
        errors.push('El nombre es requerido');
      }

      if (firstNameControl.errors['pattern']) {
        errors.push('El nombre solo debe contener letras y espacios');
      }
    }

    const lastNameControl = this.registerForm.get('lastName');

    if (lastNameControl?.errors) {
      if (lastNameControl.errors['required']) {
        errors.push('El apellido es requerido');
      }

      if (lastNameControl.errors['pattern']) {
        errors.push('El apellido solo debe contener letras y espacios');
      }
    }

    const emailControl = this.registerForm.get('email');

    if (emailControl?.errors) {
      if (emailControl.errors['required']) {
        errors.push('El email es requerido');
      }

      if (emailControl.errors['pattern']) {
        errors.push('El formato del email no es válido');
      }
    }

    const passwordControl = this.registerForm.get('password');

    if (passwordControl?.errors) {
      if (passwordControl.errors['required']) {
        errors.push('La contraseña es requerida');
      }

      if (passwordControl.errors['minlength']) {
        errors.push('La contraseña debe tener al menos 8 caracteres');
      }

      if (passwordControl.errors['pattern']) {
        errors.push('La contraseña debe contener al menos una letra y un número');
      }
    }

    const confirmPasswordControl = this.registerForm.get('confirmPassword');

    if (confirmPasswordControl?.errors) {
      if (confirmPasswordControl.errors['required']) {
        errors.push('Debes confirmar la contraseña');
      }

      if (confirmPasswordControl.errors['passwordMismatch']) {
        errors.push('Las contraseñas no coinciden');
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

  private async showSuccessMessage() {
    const toast = await this.toastController.create({
      message: '¡Registro exitoso! Ahora puedes iniciar sesión.',
      duration: 3000,
      position: 'top',
      color: 'success',
      icon: 'checkmark-circle-outline'
    });

    await toast.present();
  }

  private async showErrorMessage(message: string) {
    const alert = await this.alertController.create({
      header: 'Error de registro',
      message,
      buttons: ['OK']
    });

    await alert.present();
  }
}