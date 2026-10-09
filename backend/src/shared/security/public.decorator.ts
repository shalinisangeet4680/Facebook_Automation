import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "isPublic";

export const Public = () => SetMetadata(IS_PUBLIC, true);

export const IS_EXTERNAL_CLIENT = "isExternalClient";

export const ExternalClient = () => SetMetadata(IS_EXTERNAL_CLIENT, true);
