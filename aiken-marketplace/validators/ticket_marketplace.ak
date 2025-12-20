use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/option
use cardano/transaction.{OutputReference, Transaction}

pub type Datum {
  event_id: ByteArray,
  seller: VerificationKeyHash,
  price: Int,
  ticket_number: ByteArray,
  event_date: Int,
  status: Int,
}

// 0: locked, 1: unlocked, 2: burned

pub type Redeemer {
  action: Int,
  // 0: lock, 1: unlock, 2: burn, 3: relock
  buyer: Option<VerificationKeyHash>,
  new_price: Option<Int>,
  quantity: Int,
}

validator ticket_marketplace {
  spend(
    datum: Option<Datum>,
    redeemer: Redeemer,
    out_ref: OutputReference,
    self: Transaction,
  ) {
    when datum is {
      Some(d) ->
        when redeemer.action is {
          0 -> {
            // lock
            expect d.status == 0
            True
          }
          1 -> {
            // unlock (buy)
            expect d.status == 0
            True
          }
          2 -> {
            // burn
            expect d.status == 1
            True
          }
          3 -> {
            // relock
            expect d.status == 1
            True
          }
          _ -> False
        }
      None -> False
    }
  }

  else(_) {
    fail
  }
}
