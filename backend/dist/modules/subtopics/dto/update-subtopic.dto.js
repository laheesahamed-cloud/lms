"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateSubtopicDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_subtopic_dto_1 = require("./create-subtopic.dto");
class UpdateSubtopicDto extends (0, mapped_types_1.PartialType)(create_subtopic_dto_1.CreateSubtopicDto) {
}
exports.UpdateSubtopicDto = UpdateSubtopicDto;
//# sourceMappingURL=update-subtopic.dto.js.map