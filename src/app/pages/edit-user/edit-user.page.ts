import { Component, OnInit, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import {
  IonAvatar,
  IonButton,
  IonInput,
  IonTextarea,
  IonContent,
} from '@ionic/angular/standalone';
import { User } from 'src/app/models/user.model';
import { UserService } from 'src/app/services/user/user.service';
import { Observable, Subscription, of } from 'rxjs';
import { first, switchMap } from 'rxjs/operators';
import { Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-edit-user',
  templateUrl: './edit-user.page.html',
  styleUrls: ['./edit-user.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IonContent,
    IonAvatar,
    IonButton,
    IonInput,
    IonTextarea,
  ],
})
export class EditUserPage implements OnInit, OnDestroy {
  @ViewChild('input') input!: IonInput;

  form: FormGroup;
  user$: Observable<User>;

  userEmail = '';

  originalUser: User = {
    first_name: '',
    last_name: '',
    email: '',
    avatar: '',
    description: ''
  };

  private userSubscription?: Subscription;
  private routerSubscription?: Subscription;

  isSaving = false;
  isNavigatingAway = false;
  isInitialLoad = true;

  selectedAvatarFile: File | null = null;
  avatarPreview = '';

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private router: Router
  ) {
    this.form = this.fb.group({
      first_name: [''],
      last_name: [''],
      description: [''],
    });

    this.user$ = this.userService.getUser();
  }

  ionViewDidEnter(): void {
    setTimeout(() => {
      this.input?.setFocus();
    }, 100);
  }

  ngOnInit(): void {
    this.isInitialLoad = true;

    this.userSubscription = this.user$.pipe(first()).subscribe((user: User) => {
      this.originalUser = { ...user };
      this.userEmail = user.email;
      this.avatarPreview = user.avatar || '';

      this.form.patchValue(
        {
          first_name: user.first_name,
          last_name: user.last_name,
          description: user.description || ''
        },
        { emitEvent: false }
      );

      this.form.enable();

      setTimeout(() => {
        this.isInitialLoad = false;
      }, 100);
    });

    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd && !this.isSaving) {
        this.isNavigatingAway = true;
      }
    });
  }

  ngOnDestroy(): void {
    this.userSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
  }

  onInputFilter(
    event: CustomEvent,
    controlName: 'first_name' | 'last_name' | 'description'
  ): void {
    const value = (event.target as HTMLIonInputElement).value ?? '';

    const patterns = {
      first_name: /[^a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+/g,
      last_name: /[^a-zA-ZÁÉÍÓÚáéíóúÑñ\s]+/g,
      description: /[^a-zA-Z0-9ÁÉÍÓÚáéíóúÑñ\s.,¡!¿?()"'/-]+/g,
    };

    const filteredValue = (value as string).replace(patterns[controlName], '');

    if (this.isInitialLoad) {
      return;
    }

    this.form.get(controlName)?.setValue(filteredValue, { emitEvent: true });
  }

  goBack(): void {
    if (!this.isSaving) {
      this.isNavigatingAway = true;
      this.router.navigate(['/profile']);
    }
  }

  onAvatarSelected(event: Event): void {
    if (this.isInitialLoad || this.isSaving) {
      return;
    }

    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      console.error('El archivo seleccionado no es una imagen.');
      input.value = '';
      return;
    }

    this.selectedAvatarFile = file;

    const reader = new FileReader();

    reader.onload = () => {
      this.avatarPreview = reader.result as string;
    };

    reader.readAsDataURL(file);

    input.value = '';
  }

  formSubmit(): void {
    if (this.isInitialLoad || this.isSaving) {
      return;
    }

    const updatedUser: User = {
      ...this.originalUser,
      first_name: this.form.value.first_name,
      last_name: this.form.value.last_name,
      description: this.form.value.description || '',
      email: this.userEmail
    };

    const hasProfileChanges =
      updatedUser.first_name !== this.originalUser.first_name ||
      updatedUser.last_name !== this.originalUser.last_name ||
      updatedUser.description !== (this.originalUser.description || '');

    const hasAvatarChanges = this.selectedAvatarFile !== null;

    if (!hasProfileChanges && !hasAvatarChanges) {
      this.goBack();
      return;
    }

    this.isSaving = true;
    this.isNavigatingAway = false;
    this.form.disable();

    this.saveProfileAndAvatar(updatedUser, hasProfileChanges, hasAvatarChanges);
  }

  private saveProfileAndAvatar(
    updatedUser: User,
    hasProfileChanges: boolean,
    hasAvatarChanges: boolean
  ): void {
    let request$: Observable<User | null>;

    if (hasProfileChanges) {
      request$ = this.userService.setUser(updatedUser);
    } else {
      request$ = of(null);
    }

    request$
      .pipe(
        switchMap((): Observable<User | null> => {
          if (hasAvatarChanges && this.selectedAvatarFile) {
            return this.userService.updateAvatar(this.selectedAvatarFile);
          }

          return of(null);
        }),
        switchMap((): Observable<User> => {
          return this.userService.refreshUserFromBackend();
        })
      )
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.isNavigatingAway = true;
          this.selectedAvatarFile = null;
          this.router.navigate(['/profile']);
        },
        error: (error: unknown) => {
          console.error('Error al actualizar usuario:', error);
          this.isSaving = false;
          this.isNavigatingAway = false;
          this.form.enable();
        }
      });
  }
}