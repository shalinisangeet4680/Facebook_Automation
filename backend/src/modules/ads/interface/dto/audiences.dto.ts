import { IsObject, IsString, Length } from "class-validator";

export class KeyedOptionDto {
  key: string;
  name: string;
}

export class CityOptionDto extends KeyedOptionDto {
  radiusKm?: number | null;
}

export class InterestOptionDto {
  id: string;
  name: string;
}

export class PlanTargetingDto {
  countries: string[];
  regions: KeyedOptionDto[];
  cities: CityOptionDto[];
  ageMin: number;
  ageMax: number;
  genders: "all" | "male" | "female";
  interests: InterestOptionDto[];
  workPositions: InterestOptionDto[];
  industries: InterestOptionDto[];
  behaviors: InterestOptionDto[];
  customAudiences?: InterestOptionDto[];
  excludedCustomAudiences?: InterestOptionDto[];
}

export class SaveAudienceDto {
  @IsString()
  @Length(1, 80)
  name: string;

  @IsObject()
  targeting: PlanTargetingDto;
}

export class SavedAudienceDto {
  id: string;
  name: string;
  targeting: PlanTargetingDto;
  createdAt: string;
  updatedAt: string;
}

export class SavedAudienceListDto {
  data: SavedAudienceDto[];
}

export class CustomAudienceDto {
  id: string;
  name: string;
  subtype: string | null;
  approximateCount: number | null;
}

export class CustomAudienceListDto {
  data: CustomAudienceDto[];
}
