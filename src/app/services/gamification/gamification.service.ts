import { Injectable } from '@angular/core';

export interface UserLevel {
  name: string;
  minPoints: number;
  maxPoints: number | null;
}

export interface Badge {
  icon: string;
  name: string;
  description: string;
  unlocked: boolean;
}

export interface Activity {
  icon: string;
  title: string;
  points: number;
  date: string;
}

@Injectable({
  providedIn: 'root'
})
export class GamificationService {
  // Datos temporales simulados
  visitedPlaces = 6;
  favoritePlaces = 4;
  completedRoutes = 2;
  customRoutes = 1;
  chatbotUses = 3;
  arExperiences = 0;

  levels: UserLevel[] = [
    { name: 'Visitante inicial', minPoints: 0, maxPoints: 99 },
    { name: 'Explorador novato', minPoints: 100, maxPoints: 299 },
    { name: 'Rastreador cultural', minPoints: 300, maxPoints: 599 },
    { name: 'Guía regional', minPoints: 600, maxPoints: 999 },
    { name: 'Maestro explorador', minPoints: 1000, maxPoints: null }
  ];

  recentActivities: Activity[] = [
    {
      icon: '📍',
      title: 'Visitaste Parque Museo La Venta',
      points: 50,
      date: 'Hoy'
    },
    {
      icon: '🧭',
      title: 'Creaste una ruta personalizada',
      points: 30,
      date: 'Hoy'
    },
    {
      icon: '❤️',
      title: 'Agregaste Casa de los Azulejos a favoritos',
      points: 10,
      date: 'Ayer'
    },
    {
      icon: '💬',
      title: 'Usaste el chatbot para pedir una recomendación',
      points: 5,
      date: 'Ayer'
    }
  ];

  getUserPoints(): number {
    return (
      this.visitedPlaces * 50 +
      this.favoritePlaces * 10 +
      this.completedRoutes * 150 +
      this.customRoutes * 30 +
      this.chatbotUses * 5 +
      this.arExperiences * 80
    );
  }

  getCurrentLevel(): UserLevel {
    const points = this.getUserPoints();

    return this.levels.find(level => {
      if (level.maxPoints === null) {
        return points >= level.minPoints;
      }

      return points >= level.minPoints && points <= level.maxPoints;
    }) || this.levels[0];
  }

  getNextLevel(): UserLevel | null {
    const currentLevel = this.getCurrentLevel();
    const currentIndex = this.levels.findIndex(level => level.name === currentLevel.name);

    return this.levels[currentIndex + 1] || null;
  }

  getPointsToNextLevel(): number {
    const points = this.getUserPoints();
    const nextLevel = this.getNextLevel();

    if (!nextLevel) {
      return 0;
    }

    return Math.max(nextLevel.minPoints - points, 0);
  }

  getProgressPercent(): number {
    const points = this.getUserPoints();
    const currentLevel = this.getCurrentLevel();
    const nextLevel = this.getNextLevel();

    if (!nextLevel) {
      return 100;
    }

    const progress = ((points - currentLevel.minPoints) / (nextLevel.minPoints - currentLevel.minPoints)) * 100;

    return Math.min(Math.max(progress, 0), 100);
  }

  getBadges(): Badge[] {
    const points = this.getUserPoints();

    return [
      {
        icon: '📍',
        name: 'Primer destino',
        description: 'Marca tu primer lugar como visitado.',
        unlocked: this.visitedPlaces >= 1
      },
      {
        icon: '🌿',
        name: 'Explorador natural',
        description: 'Visita 3 lugares turísticos.',
        unlocked: this.visitedPlaces >= 3
      },
      {
        icon: '🧭',
        name: 'Creador de rutas',
        description: 'Crea tu primera ruta personalizada.',
        unlocked: this.customRoutes >= 1
      },
      {
        icon: '🏛️',
        name: 'Guardián cultural',
        description: 'Completa 2 rutas turísticas.',
        unlocked: this.completedRoutes >= 2
      },
      {
        icon: '💬',
        name: 'Explorador asistido',
        description: 'Usa el chatbot para recibir recomendaciones.',
        unlocked: this.chatbotUses >= 1
      },
      {
        icon: '🚆',
        name: 'Viajero Tren Maya',
        description: 'Consulta rutas relacionadas con el Tren Maya.',
        unlocked: true
      },
      {
        icon: '👓',
        name: 'Explorador RA',
        description: 'Visualiza una experiencia de realidad aumentada.',
        unlocked: this.arExperiences >= 1
      },
      {
        icon: '🏆',
        name: 'Embajador de Tabasco',
        description: 'Alcanza 1000 puntos dentro de NEXO.',
        unlocked: points >= 1000
      }
    ];
  }

  getUnlockedBadgesCount(): number {
    return this.getBadges().filter(badge => badge.unlocked).length;
  }
}