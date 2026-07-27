import type { InventoryMovement } from "./types";

type InventoryPositionMovement = Pick<
  InventoryMovement,
  "id" | "quantity_delta" | "unit_cost" | "movement_date" | "created_at"
>;

export function calculateInventoryPosition(movements: InventoryPositionMovement[]) {
  let quantityOnHand = 0;
  let averageCost = 0;

  const ordered = [...movements].sort((left, right) =>
    left.movement_date.localeCompare(right.movement_date) ||
    left.created_at.localeCompare(right.created_at) ||
    left.id.localeCompare(right.id)
  );

  ordered.forEach((movement) => {
    const quantityDelta = Number(movement.quantity_delta);
    const unitCost = Math.max(0, Number(movement.unit_cost));
    const nextQuantity = quantityOnHand + quantityDelta;

    if (quantityDelta > 0 && unitCost > 0 && nextQuantity > 0) {
      averageCost =
        ((quantityOnHand * averageCost) + (quantityDelta * unitCost)) /
        nextQuantity;
    }
    quantityOnHand = nextQuantity;
  });

  return { quantityOnHand, averageCost };
}
