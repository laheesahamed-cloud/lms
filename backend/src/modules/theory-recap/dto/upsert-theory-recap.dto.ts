import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';

/// The body of PUT /theory-recap/question/:id.
///
/// EVERY property needs a decorator. The global ValidationPipe runs with
/// `whitelist` and `forbidNonWhitelisted`, which judge a property by whether it
/// carries one — so this class, which had none, rejected its own fields:
///
///   property conceptName should not exist, property etiology should not
///   exist, ...
///
/// Nothing caught it because the AI path never comes through here. It calls
/// the service's upsert() directly, so only a MANUAL save — the editor, or a
/// bulk import carrying its own theory — ever hit the pipe, and that had been
/// failing since the pipe was turned on.
export class UpsertTheoryRecapDto {
  @IsOptional()
  @IsString()
  conceptName?: string;

  @IsOptional()
  @IsString()
  hierarchyCourse?: string;

  @IsOptional()
  @IsString()
  hierarchySubject?: string;

  @IsOptional()
  @IsString()
  hierarchyTopic?: string;

  @IsOptional()
  @IsString()
  hierarchyLesson?: string;

  // Each list is serialised to JSON by the service, which accepts an array of
  // strings. The element type is not asserted here because the service already
  // coerces every entry, and a stricter rule would reject a recap for a single
  // stray number rather than storing the twenty good lines around it.
  @IsOptional()
  @IsArray()
  etiology?: string[];

  @IsOptional()
  @IsArray()
  pathophysiology?: string[];

  @IsOptional()
  @IsArray()
  clinicalFeatures?: string[];

  @IsOptional()
  @IsArray()
  investigations?: string[];

  @IsOptional()
  @IsArray()
  treatment?: string[];

  @IsOptional()
  @IsArray()
  keyPoints?: string[];

  @IsOptional()
  @IsString()
  mnemonic?: string;

  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected'])
  reviewedStatus?: 'pending' | 'approved' | 'rejected';
}
