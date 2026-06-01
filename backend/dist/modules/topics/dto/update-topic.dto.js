"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTopicDto = void 0;
const mapped_types_1 = require("@nestjs/mapped-types");
const create_topic_dto_1 = require("./create-topic.dto");
class UpdateTopicDto extends (0, mapped_types_1.PartialType)(create_topic_dto_1.CreateTopicDto) {
}
exports.UpdateTopicDto = UpdateTopicDto;
//# sourceMappingURL=update-topic.dto.js.map