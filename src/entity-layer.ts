import { Actor, Entity, vec } from "excalibur";
import { LdtkResource } from "./ldtk-resource";
import { LdtkEntityInstance, LdtkLayerInstance } from "./types";

export class EntityLayer {
    public entities: Entity[] = [];
    public ldtkToEntity = new Map<LdtkEntityInstance, Entity>();
    public entityToLdtk = new Map<Entity, LdtkEntityInstance>();
    constructor(public readonly ldtkLayer: LdtkLayerInstance, private resource: LdtkResource, public readonly order: number) {
        const offset = vec(ldtkLayer.__pxTotalOffsetX, ldtkLayer.__pxTotalOffsetY);
        if (ldtkLayer.entityInstances) {
            for (let entity of ldtkLayer.entityInstances) {
                // TODO come up with tags that make sense to communicate to excalibur
                // TODO metadata pivotX/Y
                // TODO tileRenderMode
                const entityMetadata = resource.projectMetadata.defs.entities.find(e => {
                    return e.identifier === entity.__identifier
                });
                if (resource.factories.has(entity.__identifier)) {
                    const factory = resource.factories.get(entity.__identifier);
                    if (factory) {
                        const newEntity = factory({
                            type: entity.__identifier,
                            worldPos: vec(entity.px[0], entity.px[1]).add(offset),
                            entity,
                            definition: entityMetadata,
                            layer: this,
                        });
                        if (newEntity) {
                            this.entities.push(newEntity);
                            this.ldtkToEntity.set(entity, newEntity);
                            this.entityToLdtk.set(newEntity, entity);
                        }
                    }
                } else {
                    const actor = new Actor({
                        name: entity.__identifier,
                        pos: vec(entity.px[0], entity.px[1]),
                        width: entity.width,
                        height: entity.height,
                        anchor: vec(entityMetadata?.pivotX ?? 0, entityMetadata?.pivotY ?? 0),
                        z: order
                    });
                    if (entity.__tile) {
                        const ts = resource.tilesets.get(entity.__tile.tilesetUid);
                        if (ts) {
                            const tsxCoord = Math.floor(entity.__tile.x / entity.__tile.w);
                            const tsyCoord = Math.floor(entity.__tile.y / entity.__tile.h);
                            const sprite = ts.spritesheet.getSprite(tsxCoord, tsyCoord);
                            if (sprite) {
                                actor.graphics.use(sprite);
                            }
                        }
                    }
                    this.entities.push(actor);
                    this.ldtkToEntity.set(entity, actor);
                    this.entityToLdtk.set(actor, entity);
                }
            }
        }
    }

    runFactory(ldtkEntityIdentifier: string): Entity | undefined {
        if (this.resource.factories.has(ldtkEntityIdentifier)) {
            if (this.ldtkLayer.entityInstances) {
                for (let entity of this.ldtkLayer.entityInstances) {
                    const entityMetadata = this.resource.projectMetadata.defs.entities.find(e => {
                        return e.identifier === entity.__identifier
                    });
                    const factory = this.resource.factories.get(entity.__identifier);
                    if (factory) {
                        const newEntity = factory({
                            type: entity.__identifier,
                            worldPos: vec(entity.px[0], entity.px[1]),
                            entity,
                            definition: entityMetadata,
                            layer: this,
                        });
                        if (newEntity) {
                            // remove any pre done entities if a factor covered it
                            const preExisting = this.ldtkToEntity.get(entity);
                            if (preExisting) {
                                const index = this.entities.indexOf(preExisting);
                                if (index > -1) {
                                    this.entities.splice(index, 1);
                                    this.ldtkToEntity.delete(entity);
                                    this.entityToLdtk.delete(preExisting);
                                }
                            }

                            this.entities.push(newEntity);
                            this.ldtkToEntity.set(entity, newEntity);
                            this.entityToLdtk.set(newEntity, entity);
                            return newEntity;
                        }
                    }
                }
            }
        }
    }

    /**
     * Search layer for entities that match an identifier (case insensitive)
     * @param identifier 
     * @returns 
     */
    getLdtkEntitiesByIdentifier(identifier: string): LdtkEntityInstance[] {
        return this.ldtkLayer.entityInstances.filter(e => e.__identifier.toLocaleLowerCase() === identifier.toLowerCase());
    }

    /**
     * Search layer for entities that match a field and optionally a value (both case insensitive)
     * @param fieldIdentifier 
     * @param value
     */
    getLdtkEntitiesByField(fieldIdentifier: string, value?: any): LdtkEntityInstance[] {
        return this.ldtkLayer.entityInstances.filter(e => {
            if (value !== undefined) {
                let normalizedValue = value;
                if (typeof value === 'string') {
                    normalizedValue = value.toLocaleLowerCase();
                }

                const field = e.fieldInstances.find(f => f.__identifier.toLocaleLowerCase() === fieldIdentifier.toLocaleLowerCase());
                if (field) {
                    return field.__value === normalizedValue;
                }
                return false;
            } else {
                return !!e.fieldInstances.find(f => f.__identifier.toLocaleLowerCase() === fieldIdentifier.toLocaleLowerCase());
            }
        });
    }
}