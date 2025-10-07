import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export enum Platform {
    IOS = 'ios',
    ANDROID = 'android'
}

@Entity('notification_tokens')
export class NotificationTokenEntity {

    @PrimaryColumn({ type: 'varchar' })
    userId: string;

    @PrimaryColumn({ type: 'varchar' })
    token: string;

    @Column({ type: 'enum', enum: Platform, nullable: false })
    platform: Platform;

    @CreateDateColumn()
    createdAt: Date;
}