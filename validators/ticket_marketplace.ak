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

// Tests (simple placeholders)
test create_ticket_success() {
  let datum =
    Datum {
      event_id: "EVENT001",
      seller: #"00000000000000000000000000000000000000000000000000000000",
      price: 5000000,
      ticket_number: "TICKET001",
      event_date: 1704067200,
      status: 0,
    }
  let redeemer =
    Redeemer { action: 0, buyer: None, new_price: None, quantity: 1 }
  let _placeholder_utxo =
    OutputReference { transaction_id: "", output_index: 0 }
  True
}

test buy_ticket_success() {
  let datum =
    Datum {
      event_id: "EVENT001",
      seller: #"11111111111111111111111111111111111111111111111111111111",
      price: 5000000,
      ticket_number: "TICKET001",
      event_date: 1704067200,
      status: 0,
    }
  let _buyer = #"22222222222222222222222222222222222222222222222222222222"
  let _redeemer =
    Redeemer { action: 1, buyer: None, new_price: None, quantity: 1 }
  True
}

test cancel_ticket_success() {
  let datum =
    Datum {
      event_id: "EVENT001",
      seller: #"00000000000000000000000000000000000000000000000000000000",
      price: 5000000,
      ticket_number: "TICKET001",
      event_date: 1704067200,
      status: 0,
    }
  let _redeemer =
    Redeemer { action: 2, buyer: None, new_price: None, quantity: 1 }
  True
}

test update_price_success() {
  let datum =
    Datum {
      event_id: "EVENT001",
      seller: #"00000000000000000000000000000000000000000000000000000000",
      price: 5000000,
      ticket_number: "TICKET001",
      event_date: 1704067200,
      status: 0,
    }
  let _redeemer =
    Redeemer { action: 3, buyer: None, new_price: Some(6000000), quantity: 1 }
  True
}
