"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePaperDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_paper_dto_1 = require("./create-paper.dto");
class UpdatePaperDto extends (0, mapped_types_1.PartialType)(create_paper_dto_1.CreatePaperDto) {
}
exports.UpdatePaperDto = UpdatePaperDto;
//# sourceMappingURL=update-paper.dto.js.map