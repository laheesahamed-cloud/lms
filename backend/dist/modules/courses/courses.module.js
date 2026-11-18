"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoursesModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const plans_module_1 = require("../plans/plans.module");
const xp_module_1 = require("../xp/xp.module");
const courses_controller_1 = require("./courses.controller");
const courses_service_1 = require("./courses.service");
const course_structure_service_1 = require("./course-structure.service");
const student_catalogue_service_1 = require("./student-catalogue.service");
const student_catalogue_controller_1 = require("./student-catalogue.controller");
let CoursesModule = class CoursesModule {
};
exports.CoursesModule = CoursesModule;
exports.CoursesModule = CoursesModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, plans_module_1.PlansModule, xp_module_1.XpModule],
        controllers: [courses_controller_1.CoursesController, student_catalogue_controller_1.StudentCatalogueController],
        providers: [courses_service_1.CoursesService, course_structure_service_1.CourseStructureService, student_catalogue_service_1.StudentCatalogueService],
        exports: [courses_service_1.CoursesService, course_structure_service_1.CourseStructureService, student_catalogue_service_1.StudentCatalogueService],
    })
], CoursesModule);
//# sourceMappingURL=courses.module.js.map