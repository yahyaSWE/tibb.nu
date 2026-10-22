"use client";
import type { IntakeContact } from '@/lib/intake-contact';
import styles from './submission.module.css';

export function IntakeContactFields({prefix,value,onChange,disabled=false}:{prefix:string;value:IntakeContact;onChange:(value:IntakeContact)=>void;disabled?:boolean}) {
  return <div className={styles.fields}>
    <label htmlFor={`${prefix}-name`}>Namn<input id={`${prefix}-name`} name="name" autoComplete="name" required maxLength={120} value={value.name} onChange={event=>onChange({...value,name:event.target.value})} disabled={disabled}/></label>
    <label htmlFor={`${prefix}-email`}>E-postadress<input id={`${prefix}-email`} name="email" type="email" autoComplete="email" required maxLength={254} value={value.email} onChange={event=>onChange({...value,email:event.target.value})} disabled={disabled}/></label>
    <label htmlFor={`${prefix}-phone`}>Telefon (valfritt)<input id={`${prefix}-phone`} name="phone" type="tel" autoComplete="tel" maxLength={50} value={value.phone} onChange={event=>onChange({...value,phone:event.target.value})} disabled={disabled}/></label>
  </div>;
}
