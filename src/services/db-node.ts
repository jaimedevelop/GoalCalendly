import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase-node';
import type { Campaign, AdvertisingWay } from '../types';

// Collection names
export const CAMPAIGNS_COLLECTION = 'campaigns';
export const ADVERTISING_WAYS_COLLECTION = 'advertisingWays';

// Campaign functions
export async function getAllCampaigns(): Promise<Campaign[]> {
  const campaignsRef = collection(db, CAMPAIGNS_COLLECTION);
  const snapshot = await getDocs(campaignsRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Campaign[];
}

export async function createCampaign(campaignData: Omit<Campaign, 'id' | 'createdAt' | 'updatedAt'>): Promise<Campaign> {
  const campaignsRef = collection(db, CAMPAIGNS_COLLECTION);
  const now = Timestamp.now();
  
  const newCampaign = {
    ...campaignData,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = await addDoc(campaignsRef, newCampaign);
  
  return {
    id: docRef.id,
    ...newCampaign,
    createdAt: newCampaign.createdAt.toDate().toISOString(),
    updatedAt: newCampaign.updatedAt.toDate().toISOString()
  } as Campaign;
}

export async function updateCampaign(id: string, updates: Partial<Campaign>): Promise<void> {
  const campaignRef = doc(db, CAMPAIGNS_COLLECTION, id);
  await updateDoc(campaignRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  const campaignRef = doc(db, CAMPAIGNS_COLLECTION, id);
  await deleteDoc(campaignRef);
}

// Advertising Ways functions
export async function getAllAdvertisingWays(): Promise<AdvertisingWay[]> {
  const advertisingWaysRef = collection(db, ADVERTISING_WAYS_COLLECTION);
  const snapshot = await getDocs(advertisingWaysRef);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as AdvertisingWay[];
}

export async function createAdvertisingWay(advertisingWayData: Omit<AdvertisingWay, 'id' | 'createdAt' | 'updatedAt'>): Promise<AdvertisingWay> {
  const advertisingWaysRef = collection(db, ADVERTISING_WAYS_COLLECTION);
  const now = Timestamp.now();
  
  const newAdvertisingWay = {
    ...advertisingWayData,
    createdAt: now,
    updatedAt: now
  };
  
  const docRef = await addDoc(advertisingWaysRef, newAdvertisingWay);
  
  return {
    id: docRef.id,
    ...newAdvertisingWay,
    createdAt: newAdvertisingWay.createdAt.toDate().toISOString(),
    updatedAt: newAdvertisingWay.updatedAt.toDate().toISOString()
  } as AdvertisingWay;
}

export async function updateAdvertisingWay(id: string, updates: Partial<AdvertisingWay>): Promise<void> {
  const advertisingWayRef = doc(db, ADVERTISING_WAYS_COLLECTION, id);
  await updateDoc(advertisingWayRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
}

export async function deleteAdvertisingWay(id: string): Promise<void> {
  const advertisingWayRef = doc(db, ADVERTISING_WAYS_COLLECTION, id);
  await deleteDoc(advertisingWayRef);
}