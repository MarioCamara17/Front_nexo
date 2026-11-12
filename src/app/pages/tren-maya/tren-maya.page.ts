import { Component, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, ModalController } from '@ionic/angular/standalone';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { TrainStation } from '../../models/train-station.model';
import { TrainStationService } from '../../services/train-station.service';
import { GamificationService } from '../../services/gamification/gamification.service';
import { RailMapComponent } from '../../components/rail-map/rail-map.component';
import { PoiModalComponent } from '../../components/poi-modal/poi-modal.component';
import { Poi } from '../../models/poi.model';
@Component({
  selector:'app-tren-maya', templateUrl:'./tren-maya.page.html',styleUrls:['./tren-maya.page.scss'],
  standalone:true, imports:[CommonModule,FormsModule,IonContent,RouterModule,RailMapComponent]
})
export class TrenMayaPage implements OnDestroy {
  @ViewChild(RailMapComponent) railMap?: RailMapComponent;
  stations: TrainStation[]=[];
  selected: TrainStation | null=null;
  places: Poi[]=[];
  radius=30;
  loading=false;
  nearbyLoading=false;
  busySlug='';
  error='';
  nearbyError='';
  visitMessage='';
  pointsSyncError='';
  private nearbySub?: Subscription;
  private active=true;
  private requestVersion=0;
  constructor(private service:TrainStationService,private gamification:GamificationService,private modal:ModalController){}
  get visitedCount():number{return this.stations.filter(s=>s.visited).length;}
  ionViewWillEnter():void{this.active=true;void this.load();}
  ionViewDidEnter():void{this.railMap?.refresh();}
  ionViewWillLeave():void{this.active=false;this.requestVersion++;this.nearbySub?.unsubscribe();this.busySlug='';this.loading=false;this.nearbyLoading=false;}
  async load():Promise<void>{
    if(this.loading)return;
    this.loading=true;this.error='';
    const version=++this.requestVersion;
    try{
      const data=await firstValueFrom(this.service.list());
      if(!this.active || version!==this.requestVersion)return;
      this.stations=data.stations;
      const slug=this.selected?.slug;
      this.selected=this.stations.find(s=>s.slug===slug)||null;
      if(this.selected)this.loadNearby();
    }catch{if(this.active&&version===this.requestVersion)this.error='No se pudieron cargar las estaciones. Revisa la conexión con el backend.';}
    finally{if(version===this.requestVersion)this.loading=false;}
  }
  select(slug:string):void{
    this.selected=this.stations.find(s=>s.slug===slug)||null;
    this.visitMessage='';this.loadNearby();
  }
  loadNearby():void{
    this.nearbySub?.unsubscribe();this.places=[];this.nearbyError='';
    if(!this.selected)return;
    this.nearbyLoading=true;
    this.nearbySub=this.service.nearby(this.selected.slug,Number(this.radius)).subscribe({
      next:data=>{this.places=data.results;this.nearbyLoading=false;},
      error:()=>{this.nearbyError='No se pudieron consultar los lugares cercanos. Puedes reintentar.';this.nearbyLoading=false;}
    });
  }
  async checkin(station:TrainStation):Promise<void>{
    if(this.busySlug || station.visited)return;
    this.busySlug=station.slug;this.visitMessage='Consultando tu ubicación…';this.pointsSyncError='';
    try{
      if(!window.isSecureContext || !navigator.geolocation)throw new Error('Para registrar una visita necesitas ubicación y una conexión HTTPS, o localhost en tu computadora.');
      const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,maximumAge:0,timeout:20000}));
      if(!this.active)return;
      if(position.coords.accuracy>station.max_accuracy_m)throw new Error(`La precisión es de ±${Math.round(position.coords.accuracy)} m. Necesitamos ${station.max_accuracy_m} m o mejor; intenta desde un lugar abierto.`);
      const response=await firstValueFrom(this.service.visit(station.slug,position));
      if(!this.active)return;
      station.visited=response.visited;station.visited_at=response.visited_at;
      this.visitMessage=response.message;
      // El servidor ya otorgó los puntos. Aquí únicamente se actualiza el perfil.
      this.gamification.loadProfile().subscribe({error:()=>this.pointsSyncError='La visita quedó guardada. No se pudo refrescar el saldo; vuelve a abrir tu perfil.'});
    }catch(error:unknown){if(this.active)this.visitMessage=this.describeError(error);}
    finally{this.busySlug='';}
  }
  private describeError(error:unknown):string{
    if(error instanceof HttpErrorResponse){
      if(error.status===401||error.status===403)return 'Inicia sesión para registrar tu visita.';
      const body=error.error as {message?:string;accuracy_m?:string[];non_field_errors?:string[]}|null;
      return body?.message||body?.non_field_errors?.[0]||(body?.accuracy_m?'La precisión de la ubicación no es suficiente. Intenta de nuevo al aire libre.':'No se pudo registrar la visita. Revisa tu conexión e inténtalo nuevamente.');
    }
    const code=(error as GeolocationPositionError)?.code;
    if(code===1)return 'Permiso de ubicación denegado. Actívalo en el navegador y en tu dispositivo.';
    if(code===2)return 'No se pudo determinar tu ubicación. Activa la ubicación y vuelve a intentarlo.';
    if(code===3)return 'Se agotó el tiempo para obtener la ubicación. Inténtalo nuevamente.';
    return error instanceof Error?error.message:'No se pudo obtener tu ubicación.';
  }
  async openPlace(poi:Poi):Promise<void>{
    const view=await this.modal.create({component:PoiModalComponent,componentProps:{id:poi.id,title:poi.name,info:poi.description,image:poi.image,video:poi.video,isRouteContext:false,history:poi.history,importance:poi.importance,recommendations:poi.recommendations,schedule:poi.schedule,cost:poi.cost,tips:poi.tips},cssClass:'poi-modal'});
    await view.present();
  }
  ngOnDestroy():void{this.active=false;this.requestVersion++;this.nearbySub?.unsubscribe();}
}
