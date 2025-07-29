import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DocumentChunkEntity } from "./entity/document-chunk.entity";
import { ChunkService } from "./chunk.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([DocumentChunkEntity])
    ],
    providers: [ChunkService],
    exports: [ChunkService]
})
export class ChunkModule { }