use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/transaction.{OutputReference, Transaction}

// Datum for ticket stored in UTxO
pub type Datum {
  event_id: ByteArray,
  seller: VerificationKeyHash,
  price: Int,
  ticket_number: ByteArray,
  event_date: Int,
  status: Int,
}

// Redeemer actions
pub type Redeemer {
  action: Int,
  buyer: Option<VerificationKeyHash>,
  new_price: Option<Int>,
  quantity: Int,
}

fn is_signed_by(
  signatories: List<VerificationKeyHash>,
  key: VerificationKeyHash,
) -> Bool {
  list.has(signatories, key)
}

validator ticket_marketplace {
  spend(
    datum_opt: Option<Datum>,
    redeemer: Redeemer,
    _out_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(datum) = datum_opt

    if redeemer.action == 0 {
      is_signed_by(tx.extra_signatories, datum.seller)
    } else if redeemer.action == 1 {
      expect Some(buyer) = redeemer.buyer
      and {
        is_signed_by(tx.extra_signatories, buyer),
        datum.status == 0,
      }
    } else if redeemer.action == 2 {
      and {
        is_signed_by(tx.extra_signatories, datum.seller),
        datum.status != 1,
      }
    } else if redeemer.action == 3 {
      expect Some(_new_price) = redeemer.new_price
      and {
        is_signed_by(tx.extra_signatories, datum.seller),
        datum.status == 0,
      }
    } else {
      fail
    }
  }

  else(_) {
    fail
  }
}
