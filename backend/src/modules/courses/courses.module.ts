import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlansModule } from '../plans/plans.module';
import { XpModule } from '../xp/xp.module';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CourseStructureService } from './course-structure.service';
import { StudentCatalogueService } from './student-catalogue.service';
import { StudentCatalogueController } from './student-catalogue.controller';

@Module({
  imports: [AuthModule, PlansModule, XpModule],
  controllers: [CoursesController, StudentCatalogueController],
  providers: [CoursesService, CourseStructureService, StudentCatalogueService],
  exports: [CoursesService, CourseStructureService, StudentCatalogueService],
})
export class CoursesModule {}
