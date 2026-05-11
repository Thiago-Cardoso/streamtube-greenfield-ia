import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVideos1778431885607 implements MigrationInterface {
    name = 'CreateVideos1778431885607'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."videos_status_enum" AS ENUM('UPLOADING', 'PROCESSING', 'READY', 'FAILED')`);
        await queryRunner.query(`CREATE TABLE "videos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(11) NOT NULL, "title" character varying(255), "status" "public"."videos_status_enum" NOT NULL DEFAULT 'UPLOADING', "file_key" character varying, "thumbnail_key" character varying, "duration" real, "size" bigint, "mime_type" character varying, "channel_id" uuid NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_5dbcc1ee100f853490582eccc71" UNIQUE ("slug"), CONSTRAINT "PK_e4c86c0cf95aff16e9fb8220f6b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5dbcc1ee100f853490582eccc7" ON "videos" ("slug") `);
        await queryRunner.query(`CREATE INDEX "IDX_023a8e4f3f1a34ff3d8ca04a4c" ON "videos" ("channel_id") `);
        await queryRunner.query(`ALTER TABLE "videos" ADD CONSTRAINT "FK_023a8e4f3f1a34ff3d8ca04a4cc" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "videos" DROP CONSTRAINT "FK_023a8e4f3f1a34ff3d8ca04a4cc"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_023a8e4f3f1a34ff3d8ca04a4c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5dbcc1ee100f853490582eccc7"`);
        await queryRunner.query(`DROP TABLE "videos"`);
        await queryRunner.query(`DROP TYPE "public"."videos_status_enum"`);
    }

}
